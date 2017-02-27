
var config = {};

config.accounting = {
    modules: ['call', 'megabyte', 'second'],

    db: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        passwd: 'root',
        database: 'pep'
    }
};

module.exports = config;
