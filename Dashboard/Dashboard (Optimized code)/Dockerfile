FROM node:18.12.1-alpine3.16

# Create app directory
WORKDIR /usr/src/app

EXPOSE 3000

# Install app dependencies
# A wildcard is used to ensure both package.json AND package-lock.json are copied
COPY package*.json ./

# RUN npm install
# If you are building your code for production
RUN npm ci --only=production

COPY . .

CMD [ "node", "--max-old-space-size=12142", "server.js" ]
