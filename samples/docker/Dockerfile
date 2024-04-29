FROM node:20-alpine

WORKDIR /usr/src/app

COPY sync/index.js ./sync.js
COPY check/index.js ./check.js
COPY validate/index.js ./validate.js
COPY deploy/index.js ./deploy.js

USER node

CMD [ "node", "$1.js" ]
