FROM node:alpine AS development

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
COPY tsconfig.json nest-cli.json ./
RUN npm install -g pnpm prisma
RUN pnpm install

COPY libs ./libs
COPY apps/auction-service ./apps/auction-service

RUN pnpm exec prisma generate --schema=apps/auction-service/src/prisma/schema/schema.prisma
RUN pnpm build auction-service

# --- Production stage ---
FROM node:alpine AS production

WORKDIR /usr/src/app

COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm
RUN pnpm install --prod

# Copy Prisma client and dist only
COPY --from=development /usr/src/app/node_modules/.prisma /usr/src/app/node_modules/.prisma
COPY --from=development /usr/src/app/node_modules/@prisma /usr/src/app/node_modules/@prisma
COPY --from=development /usr/src/app/dist ./dist

CMD ["node", "dist/apps/auction-service/main"]