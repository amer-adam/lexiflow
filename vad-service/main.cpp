#include <iostream>
#include <vector>
#include <string>
#include <chrono>
#include <cmath>
#include <algorithm>
#include <cstring>
#include "onnxruntime_cxx_api.h"
#include "httplib.h"
#include "nlohmann/json.hpp"

using json = nlohmann::json;

class SileroVAD {
public:
    SileroVAD(const std::string& model_path) {
        env = Ort::Env(ORT_LOGGING_LEVEL_WARNING, "VAD");
        session_options = Ort::SessionOptions();
        session_options.SetIntraOpNumThreads(4);
        session = Ort::Session(env, model_path.c_str(), session_options);

        // Discovery for logging
        Ort::AllocatorWithDefaultOptions allocator;
        std::cout << "[VAD] Model Inputs: ";
        for (size_t i = 0; i < session.GetInputCount(); ++i) {
            std::cout << session.GetInputNameAllocated(i, allocator).get() << " ";
        }
        std::cout << "\n[VAD] Model Outputs: ";
        for (size_t i = 0; i < session.GetOutputCount(); ++i) {
            std::cout << session.GetOutputNameAllocated(i, allocator).get() << " ";
        }
        std::cout << std::endl;

        memory_info = Ort::MemoryInfo::CreateCpu(OrtArenaAllocator, OrtMemTypeDefault);
        reset_states();
    }

    void reset_states() {
        state.assign(2 * 1 * 128, 0.0f);
        context.assign(64, 0.0f);
    }

float predict(const std::vector<float>& chunk) {
    std::vector<float> input_data(64 + chunk.size());
    std::copy(context.begin(), context.end(), input_data.begin());
    std::copy(chunk.begin(), chunk.end(), input_data.begin() + 64);

    const int64_t input_shape[] = {1, (int64_t)input_data.size()};
    const int64_t state_shape[] = {2, 1, 128};
    const int64_t sr_shape[] = {1};

    // FIX: sr must be int64_t, not float
    int64_t sr_val = 16000;

    std::vector<Ort::Value> inputs;
    inputs.push_back(Ort::Value::CreateTensor<float>(
        memory_info, input_data.data(), input_data.size(), input_shape, 2));
    inputs.push_back(Ort::Value::CreateTensor<float>(
        memory_info, state.data(), state.size(), state_shape, 3));
    inputs.push_back(Ort::Value::CreateTensor<int64_t>(  // FIX: int64_t
        memory_info, &sr_val, 1, sr_shape, 1));

    const char* input_names[] = {"input", "state", "sr"};
    const char* output_names[] = {"output", "stateN"};

    auto outputs = session.Run(
        Ort::RunOptions{nullptr},
        input_names, inputs.data(), inputs.size(),
        output_names, 2);

    float prob = outputs[0].GetTensorMutableData<float>()[0];
    float* state_ptr = outputs[1].GetTensorMutableData<float>();
    std::copy(state_ptr, state_ptr + state.size(), state.begin());

    // Update context with last 64 samples of the chunk
    std::copy(chunk.end() - 64, chunk.end(), context.begin());

    return prob;
}

private:
    Ort::Env env;
    Ort::SessionOptions session_options;
    Ort::Session session{nullptr};
    Ort::MemoryInfo memory_info{nullptr};
    std::vector<float> state;
    std::vector<float> context;
};

// WAV Parser helper
const char* find_data_chunk(const char* data, size_t size, size_t& data_size) {
    if (size < 44) return nullptr;
    size_t pos = 12;
    while (pos + 8 <= size) {
        if (std::memcmp(data + pos, "data", 4) == 0) {
            std::memcpy(&data_size, data + pos + 4, 4);
            return data + pos + 8;
        }
        uint32_t chunk_size;
        std::memcpy(&chunk_size, data + pos + 4, 4);
        pos += 8 + chunk_size;
    }
    return nullptr;
}

int main() {
    SileroVAD vad("/app/models/silero_vad.onnx");
    httplib::Server svr;

    svr.Post("/detect", [&](const httplib::Request& req, httplib::Response& res) {
        auto start_time = std::chrono::high_resolution_clock::now();
        std::cout << "[VAD] Received request. Body size: " << req.body.size() << " bytes" << std::endl;

        size_t size = req.body.size();
        if (size == 0) {
            std::cerr << "[VAD] Error: Empty body" << std::endl;
            res.status = 400;
            res.set_content("Empty body", "text/plain");
            return;
        }

        size_t data_size = 0;
        const char* audio_data = find_data_chunk(req.body.data(), size, data_size);
        if (!audio_data) {
            std::cerr << "[VAD] Error: Could not find 'data' chunk in WAV" << std::endl;
            res.status = 400;
            res.set_content("Invalid WAV", "text/plain");
            return;
        }

        std::vector<float> audio;
        size_t n_samples = data_size / 2;
        std::cout << "[VAD] Processing " << n_samples << " samples..." << std::endl;
        audio.reserve(n_samples);
        const int16_t* samples = reinterpret_cast<const int16_t*>(audio_data);
        
        float max_audio = 0.0f;
        float min_audio = 0.0f;
        for (size_t i = 0; i < n_samples; ++i) {
            float val = samples[i] / 32768.0f;
            audio.push_back(val);
            if (val > max_audio) max_audio = val;
            if (val < min_audio) min_audio = val;
        }
        std::cout << "[VAD] Audio signal range: [" << min_audio << ", " << max_audio << "]" << std::endl;

        std::vector<json> segments;
        const int window_size = 512;
        const float threshold = 0.5f;
        const int min_silence_samples = 1600; // 100ms
        const int min_speech_samples = 4000;  // 250ms

        bool triggered = false;
        int speech_start = 0;
        int temp_end = 0;
        float max_prob = 0.0f;

        vad.reset_states();
        for (int i = 0; i + window_size <= (int)audio.size(); i += window_size) {
            std::vector<float> chunk(audio.begin() + i, audio.begin() + i + window_size);
            float prob = vad.predict(chunk);
            if (prob > max_prob) max_prob = prob;

            if (prob >= threshold) {
                if (temp_end > 0) temp_end = 0;
                if (!triggered) {
                    triggered = true;
                    speech_start = i;
                    std::cout << "[VAD] >>> Speech started at " << (float)speech_start / 16000.0f << "s" << std::endl;
                }
            } else if (triggered && prob < (threshold - 0.15f)) {
                if (temp_end == 0) temp_end = i;
                if (i - temp_end >= min_silence_samples) {
                    if (temp_end - speech_start >= min_speech_samples) {
                        float end_time = (float)temp_end / 16000.0f;
                        std::cout << "[VAD] <<< Speech ended at " << end_time << "s (Duration: " << end_time - ((float)speech_start / 16000.0f) << "s)" << std::endl;
                        segments.push_back({{"start", (float)speech_start / 16000.0f}, {"end", end_time}});
                    } else {
                        std::cout << "[VAD] (Discarded segment: too short)" << std::endl;
                    }
                    triggered = false;
                    temp_end = 0;
                }
            }
        }

        if (triggered && (int)audio.size() - speech_start >= min_speech_samples) {
            segments.push_back({{"start", (float)speech_start / 16000.0f}, {"end", (float)audio.size() / 16000.0f}});
        }

        auto end_time = std::chrono::high_resolution_clock::now();
        auto duration = std::chrono::duration_cast<std::chrono::milliseconds>(end_time - start_time).count();
        std::cout << "[VAD] Done. Found " << segments.size() << " segments in " << duration << "ms. Max prob seen: " << max_prob << std::endl;

        res.set_content(json({{"segments", segments}}).dump(), "application/json");
    });

    std::cout << "Native C++ VAD Server running on port 8000..." << std::endl;
    svr.listen("0.0.0.0", 8000);
    return 0;
}
