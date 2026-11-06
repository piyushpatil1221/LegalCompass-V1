FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm install
COPY . .
# Public LegalCompass API key, baked into the browser bundle at build time
ARG NEXT_PUBLIC_LEGALCOMPASS_API_KEY=""
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_LEGALCOMPASS_API_KEY=$NEXT_PUBLIC_LEGALCOMPASS_API_KEY
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
