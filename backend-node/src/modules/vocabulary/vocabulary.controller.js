const vocabularyService = require('./vocabulary.service');
const { createListSchema, addVocabularySchema, createListFromVideoSchema } = require('./vocabulary.validator');

async function createList(req, res, next) {
  try {
    const validatedData = createListSchema.parse(req.body);
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await vocabularyService.createList({ ...validatedData, userId });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getUserLists(req, res, next) {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await vocabularyService.getUserLists(userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

async function addWordToList(req, res, next) {
  try {
    const listId = req.params.listId;
    const validatedData = addVocabularySchema.parse(req.body);
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await vocabularyService.addWordToList(listId, validatedData, userId);
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function getListDetails(req, res, next) {
  try {
    const listId = req.params.listId;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await vocabularyService.getListDetails(listId, userId);
    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// Preserving from Phase 1
async function getDictionaryDefinition(req, res, next) {
  const { word } = req.query;
  if (!word) {
    return res.status(400).json({ error: "Word parameter is required" });
  }
  try {
    const data = await vocabularyService.getDefinition(word);
    res.json(data);
  } catch (error) {
    next(error);
  }
}

async function createListFromVideo(req, res, next) {
  try {
    const validatedData = createListFromVideoSchema.parse(req.body);
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const result = await vocabularyService.createListFromVideo({ ...validatedData, userId });
    return res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

async function deleteList(req, res, next) {
  try {
    const listId = req.params.listId;
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    await vocabularyService.deleteList(listId, userId);
    return res.status(204).end();
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createList,
  createListFromVideo,
  getUserLists,
  addWordToList,
  getListDetails,
  getDictionaryDefinition,
  deleteList
};
