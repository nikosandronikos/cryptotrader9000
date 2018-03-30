#Use the official debian package.
FROM node:carbon

#Tell Nikos how bad he is.
LABEL maintainer="Nikos is bad."

WORKDIR /home/docker/cryptobot/

ADD . .

ENV NODE_ENV development
ENV NPM_CONFIG_LOGLEVEL info

RUN npm install

#RUN node --experimental-modules src/main.mjs
CMD [ "npm", "start" ]