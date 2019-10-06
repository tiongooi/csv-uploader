const express    = require('express'),
      csv        = require('csvtojson'),
      { Client } = require('pg'),
      format     = require('pg-format'),
      sql        = require('sql'),
      path       = require('path'),
      chunk      = require('./lib/chunk'),
      multer     = require('multer'),
      upload     = multer({ dest: 'uploads/' }),
      TABLE_NAME = 'heyheyheyhohoho'

;(async () => {
  const app    = express(),
        client = new Client({database: 'postgres'})

  await client.connect(err => client.query(buildQuery('createTable'), err => err && console.log(err)))

  app.get('/', (req, res) => res.sendFile(path.join(__dirname + '/public/index.html')))

  app.post('/upload', upload.single('account'), async (req, res) => {
    if (!req.file) return res.status(400).send('No files were uploaded.')

    const data            = await csv().fromFile(req.file.path).then(json => json),
          created         = (+new Date()).toString(),
          transformedData = data.map(({name, ...rest}) => ({name, rest: JSON.stringify(rest), created})),
          batch           = chunk(transformedData, 10000),
          {rows: newList} = await Promise.all(batch.map(arr => client.query(buildQuery('insert', arr))))
                            .then(() => client.query(buildQuery('select', {created})))

    res.status(200).send({newList, orderByAsc: true})
  })

  const buildQuery = (action, data) => {
    let query, Account = sql.define({name: TABLE_NAME, columns: ['name', 'rest', 'created']})
    switch(action) {
      case 'insert':
      query = Account.insert(data).returning(Account.name).toQuery()
      break
      case 'select':
      query = Account.select().from(Account).where(Account.created.equals(data.created)).order(Account.name).toQuery()
      break
      case 'createTable':
      query = `CREATE TABLE ${TABLE_NAME} (name TEXT, rest TEXT, created TEXT)`
      break
    }
    return query
  }

  app.listen(3000, () => console.log('listening to port 3000'))
})()
