const sqlite3 = require("sqlite3").verbose();

const db = new sqlite3.Database("./files-database.db", (err) => {
    if (err) {
        console.log(err.message);
        throw err;
    };
    console.log("Conntected to database !")
});

const createTableSql = `
CREATE TABLE IF NOT EXISTS pdfs (
    id TEXT PRIMARY KEY NOT NULL,
    file_path TEXT NOT NULL,
    dimensions TEXT NOT NULL
  );`;

db.serialize(() => {
    db.run(createTableSql , (err) => {
        if (err) {
            console.log(err.message);
            throw err;
        };
        console.log("Fetched the create table code");
    });
    });
    
db.close((err) => {
  if (err) {
    console.error(err.message);
  }
  console.log('Closed the database connection.');
});
