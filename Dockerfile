FROM node:14-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
RUN apk add python make gcc g++
COPY ["package.json", "package-lock.json*", "npm-shrinkwrap.json*", "./"]
RUN npm install --production
RUN mv node_modules ../
COPY . .
CMD ["node", "app.js"]