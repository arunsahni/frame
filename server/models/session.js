var Joi = require('joi');
var Uuid = require('node-uuid');
var Async = require('async');
var Bcrypt = require('bcrypt');
var ObjectAssign = require('object-assign');
var BaseModel = require('hapi-mongo-models').BaseModel;


var Session = BaseModel.extend({
    constructor: function (attrs) {

        ObjectAssign(this, attrs);
    }
});


Session._collection = 'sessions';


Session.schema = Joi.object().keys({
    _id: Joi.object(),
    username: Joi.string().required(),
    key: Joi.string().required(),
    time: Joi.date().required()
});


Session.indexes = [
    [{ username: 1 }]
];


Session.generateKeyHash = function (callback) {

    var key = Uuid.v4();

    Async.auto({
        salt: function (done) {

            Bcrypt.genSalt(10, done);
        },
        hash: ['salt', function (done, results) {

            Bcrypt.hash(key, results.salt, done);
        }]
    }, function (err, results) {

        if (err) {
            return callback(err);
        }

        callback(null, {
            key: key,
            hash: results.hash
        });
    });
};


Session.create = function (username, callback) {

    var self = this;

    Async.auto({
        keyHash: this.generateKeyHash.bind(this),
        newSession: ['keyHash', function (done, results) {

            var document = {
                username: username,
                key: results.keyHash.hash,
                time: new Date()
            };

            self.insert(document, done);
        }],
        clean: ['newSession', function (done, results) {

            var query = {
                username: username,
                key: { $ne: results.keyHash.hash }
            };

            self.remove(query, done);
        }]
    }, function (err, results) {

        if (err) {
            return callback(err);
        }

        results.newSession[0].key = results.keyHash.key;

        callback(null, results.newSession[0]);
    });
};


Session.findByCredentials = function (username, key, callback) {

    var self = this;

    Async.auto({
        session: function (done) {

            var query = { username: username };
            self.findOne(query, done);
        },
        keyMatch: ['session', function (done, results) {

            if (!results.session) {
                return done(null, false);
            }

            var source = results.session.key;
            Bcrypt.compare(key, source, done);
        }]
    }, function (err, results) {

        if (err) {
            return callback(err);
        }

        if (results.keyMatch) {
            return callback(null, results.session);
        }

        callback();
    });
};


module.exports = Session;
