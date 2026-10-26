FROM node:26-alpine
WORKDIR /app
COPY packages/shared /app/packages/shared
COPY packages/api/package.json packages/api/package-lock.json /app/packages/api/
WORKDIR /app/packages/api
RUN npm ci --omit=dev
COPY packages/api /app/packages/api
ENV NODE_ENV=production
EXPOSE 4010
CMD ["npm", "start"]
