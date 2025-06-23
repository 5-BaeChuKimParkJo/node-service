FROM node:22-alpine AS development

WORKDIR /usr/src/app

COPY package*.json ./
COPY tsconfig.json tsconfig.json
COPY nest-cli.json nest-cli.json

RUN npm i -g prisma

RUN npm i

COPY libs libs
COPY apps/auction-service apps/auction-service

RUN npx prisma generate --schema=apps/auction-service/src/prisma/schema/schema.prisma
RUN npm run build auction-service

CMD ["npm", "start:dev", "auction-service"]

FROM node:22-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install -g prisma pm2

RUN npm install
COPY apps/auction-service/src/prisma/schema/schema.prisma apps/auction-service/src/prisma/schema/schema.prisma
RUN npx prisma generate --schema=apps/auction-service/src/prisma/schema/schema.prisma
RUN npm prune --prod

COPY --from=development /usr/src/app/dist ./dist

CMD ["pm2-runtime", "--name", "auction-service", "dist/apps/auction-service/main.js", "-i", "max"]