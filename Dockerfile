FROM node:6.11.4-alpine
WORKDIR /usr/src/app

COPY package.json /usr/src/app
COPY yarn.lock /usr/src/app
COPY handler.js /usr/src/app
COPY local.js /usr/src/app

RUN npm install -g yarn
RUN yarn install

CMD ["node", "local.js"]
