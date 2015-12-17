# ubicall-web-service
exposed ubicall web service for public and internal use , for documentation checkout [development](http://developer-dev.ubicall.com/docs/) or [production](http://developer.ubicall.com/docs/) links.

**preinstall:**

  ```bash
   sudo mkdir -p /opt/ubicall/conf/
   sudo chown :nginx /opt/ubicall/conf/
   sudo mkdir -p /var/www/html/
   sudo chown :nginx /var/www/html/
  ```


**generate & deploy API documentation :**

  *make sure you add the below line to your* **/etc/hosts** *file :*

    ```
    10.0.0.170  developer-dev.ubicall.com
    ```

```bash
nvm use 0.12 && npm install
# to run test units
npm test
#grunt [preserve | prebuild] package app in development or production respectively
# node_env [test | development | production] - default _development_
# db_env - [internal | external] control db connections attributes , default *internal* which use internal_ip and internal_port to connect to DB - default _internel_
# config_version - which configuration version you like to use i.e. 20150920 - default _specified in settings.js_
# in production we use forever : https://github.com/foreverjs/forever
sudo grunt preserve && db_env=external node api.js
```
**create model from db using :**
``` bash
node_modules/sequelize-auto/bin/sequelize-auto -o "./storage/models/ubicall" -d ubicall -h localhost -u root -p 3306 -x root -e mysql
node_modules/sequelize-auto/bin/sequelize-auto -o "./storage/models/ast_rt" -d ast_rt -h localhost -u root -p 3306 -x root -e mysql
node_modules/sequelize-auto/bin/sequelize-auto -o "./storage/models/web_fs_db" -d WEB_FS_DB -h localhost -u root -p 3306 -x root -e mysql
```
**build docker images :**
```bash
# compose short cut for all next commands
docker-compose stop && docker-compose build && docker-compose up -d
# build ubicall-db-mysql-ubicall
docker build -t ubicall-mysql:0.1 docker-dependencies/mysql/
# run ubicall-mysql in detached mode, to get attached run `docker exec -it {CONTAINER_ID} bash`
docker run -d ubicall-mysql:0.1
```