# shadow-mysql  
* 对mysql进行了一层封装，mysql连接只是用连接池。
* 添加了makeSQL,makeSQLSelect等简单方法。
* 对conn没有正常release会打印日志。
* 对于一个conn的事务是否开启多个做了错误判断。
* 对于query,getConnection,beginTransaction,commit提供了promise方法，即在方法名后加Async（例如queryAsync）

##安装  
npm install shadow-mysql

##使用说明
###初始化
``` javascript
var mysql = require('shadow-mysql');
var options = {
    host: xx,
    user: xx,
    password: xx,
    database: xx,
    multipleStatements: 'true' //一次执行多条sql
}
var pool = new mysql.Pool(options);
```

###执行sql  
提供两种query方式:  
*   连接池上直接query
```javascript
pool.query(sql,function(err,rows,fields){
   ...
})
```  
*   连接池上获取连接，再query
```javascript
//获取连接，connectionName为连接名，如若忘记归还连接，则会根据这个连接名提示
pool.getConnection(connectionName, function (err,conn) {
    conn.query(sql, function (err, data) {
        if(err) ...;
        //释放连接，若超过1min不归还，底层会提示
        conn.release();
    })
});
```

###事务处理
```javascript
//connection需要通过pool.getConnection()获取
connection.beginTransaction(function(err) {
  if (err) { throw err; }
  connection.query('INSERT INTO posts SET title=?', title, function(err, result) {
    if (err) {
      return connection.rollback(function() {
        throw err;
      });
    }

    var log = 'Post ' + result.insertId + ' added';

    connection.query('INSERT INTO log SET data=?', log, function(err, result) {
      if (err) {
        return connection.rollback(function() {
          throw err;
        });
      }  
      connection.commit(function(err) {
        if (err) {
          return connection.rollback(function() {
            throw err;
          });
        }
        console.log('success!');
      });
    });
  });
});
```

###单表执行sql的简单方法(单表尽量用下面五种方法，解决了sql注入问题)
* makeSQL  
```javascript
var mysql = require('shadow-mysql');
var sql = "select * from table where id = @id@";
sql = mysql.makeSQL(sql,{id:2});
```
* makeSQLSelect  
```javascript
var sql = mysql.makeSQLSelect('hs_t',['id','name'],{id:3});
console.log(sql); //select id,name from hs_t where id = 3;
//makeSQLSelect 第4个参数为condition(object),代表除了=以外的条件查询
//暂时支持 lt:小于 gt:大于 lte:小于等于 gte:大于等于 like:模糊查询
var sql = mysql.makeSQLSelect('teams', ['*'], { id: 2 }, { a: { lt: 5, gt: 3 }, b: { like: 'tt' }, c: { lte: 2, gte: 6 } });
console.log(sql); //SELECT * FROM `teams` WHERE 1=1  AND id=2  AND a < 5 AND a > 3 AND b like '%tt%' AND c <= 2 AND c >= 6
```
* makeSQLInsert
```javascript
var sql = mysql.makeSQLInsert('hs_t',{id:3,name:'xc'});
console.log(sql);//insert into hs_t(id,name) values (3,'xc');
```
* makeSQLUpdate
```javascript
var sql = mysql.makeSQLUpdate('hs_t',{name:'xc'},{id:3});
console.log(sql);//update hs_t set name = 'xc' where id = 3;
//第4个参数同makeSQLSelect
```
* makeSQLDelete
```javascript
var sql = mysql.makeSQLDelete('hs_t',{name:'xc'});
console.log(sql);//delete from hs_t where name = 'xc';
//第4个参数同makeSQLSelect
```

###防sql注入  
如果自己写sql时，所有参数都需要用mysql.escape(param)过滤下，防止sql注入
