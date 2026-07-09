FROM node:20-slim
WORKDIR /app
COPY package*.json tsconfig.json ./
COPY prisma ./prisma
RUN npm install
RUN npx prisma generate
COPY src ./src
RUN npm run build
EXPOSE 4000
ENV NODE_ENV=production
CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]
