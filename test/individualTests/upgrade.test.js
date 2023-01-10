const assert = require('assert');
const SQLParser = require('../../lib/SQLParser.js');
const _dbName = 'sql-to-mongo-test';
const {setup, disconnect} = require('../mongo-client');

describe('node-sql-parser upgrade tests', function () {
    this.timeout(90000);
    /** @type {import('mongodb').MongoClient} */
    let mongoClient;
    before(function (done) {
        const run = async () => {
            try {
                const {client} = await setup();
                mongoClient = client;
                done();
            } catch (exp) {
                done(exp);
            }
        };
        run();
    });

    after(function (done) {
        disconnect().then(done).catch(done);
    });

    it('should work after upgrading', async () => {
        const queryText =
            "select SUM_ARRAY((select SUM_ARRAY(`Payments`,'Amount') as total from `Rentals`),'total') as t from customers";
        try {
            const parsedQuery = SQLParser.makeMongoAggregate(queryText);
            const results = await mongoClient
                .db(_dbName)
                .collection(parsedQuery.collections[0])
                .aggregate(parsedQuery.pipeline)
                .toArray();
            assert(results);
        } catch (err) {
            console.error(err);
            throw err;
        }
    });
    describe('Not Like', () => {
        describe('query part', () => {
            it('should work with like', async () => {
                const queryText =
                    "select `item` as productName from `orders` where `item` Like 'alm%'";
                try {
                    const parsedQuery = SQLParser.makeMongoAggregate(queryText);
                    const results = await mongoClient
                        .db(_dbName)
                        .collection(parsedQuery.collections[0])
                        .aggregate(parsedQuery.pipeline)
                        .toArray();
                    assert(results);
                    assert(results.length === 2);
                } catch (err) {
                    console.error(err);
                    throw err;
                }
            });
            it('should work with not like', async () => {
                const queryText =
                    "select `item` as productName from `orders` where `item` Not Like 'alm%'";
                try {
                    const parsedQuery = SQLParser.makeMongoAggregate(queryText);
                    const results = await mongoClient
                        .db(_dbName)
                        .collection(parsedQuery.collections[0])
                        .aggregate(parsedQuery.pipeline)
                        .toArray();
                    assert(results);
                    assert(results.length === 2);
                } catch (err) {
                    console.error(err);
                    throw err;
                }
            });
        });
        describe('filter condition', () => {
            it('should work with like', async () => {
                const queryText =
                    "select id,`First Name`,`Last Name`,(select * from Rentals where `Film Title` like 'MUSKETEERS%') as rentalsArr from `customers` where id=1";
                try {
                    const parsedQuery = SQLParser.makeMongoAggregate(queryText);
                    const results = await mongoClient
                        .db(_dbName)
                        .collection(parsedQuery.collections[0])
                        .aggregate(parsedQuery.pipeline)
                        .toArray();
                    assert(results);
                    assert(results.length === 1);
                    assert(results[0].rentalsArr.length === 1);
                } catch (err) {
                    console.error(err);
                    throw err;
                }
            });
            it('should work with not like', async () => {
                const queryText =
                    "select id,`First Name`,`Last Name`,(select * from Rentals where `Film Title` not like 'MUSKETEERS%') as rentalsArr from `customers` where id=1";
                try {
                    const parsedQuery = SQLParser.makeMongoAggregate(queryText);
                    const results = await mongoClient
                        .db(_dbName)
                        .collection(parsedQuery.collections[0])
                        .aggregate(parsedQuery.pipeline)
                        .toArray();
                    assert(results);
                    assert(results.length === 1);
                    assert(results[0].rentalsArr.length === 31);
                } catch (err) {
                    console.error(err);
                    throw err;
                }
            });
        });
    });
});
