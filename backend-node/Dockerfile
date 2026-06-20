FROM node:lts-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY prisma ./prisma/
RUN npx prisma generate
# pdfkit defaults to Helvetica, which has no CJK glyphs — exported PDFs with
# Chinese text (vocabulary export) render as mojibake without a real CJK
# font registered (see export.service.js). Fetched at build time rather
# than committed to the repo to avoid an 8MB binary blob in git history.
RUN apk add --no-cache curl && \
    mkdir -p assets/fonts && \
    curl -fL -o assets/fonts/NotoSansSC-Regular.otf \
      "https://github.com/notofonts/noto-cjk/raw/main/Sans/SubsetOTF/SC/NotoSansSC-Regular.otf"
COPY . .
EXPOSE 4556
CMD ["node", "index.js"]