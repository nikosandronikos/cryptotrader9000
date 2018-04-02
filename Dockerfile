#Use the official debian package.
FROM node:9

#Tell Nikos how bad he is.
LABEL maintainer="Nikos is bad."

#ADD . /crypto

#WORKDIR /crypto

ENV NODE_ENV development
ENV NPM_CONFIG_LOGLEVEL info

#RUN npm install

#RUN node --experimental-modules src/main.mjs
#CMD [ "npm", "start" ]