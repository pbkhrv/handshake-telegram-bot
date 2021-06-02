FROM node:12.18-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN apk add python make gcc g++
RUN npm install --production
RUN mv node_modules ../
COPY . .
CMD ["node", "app.js"]
