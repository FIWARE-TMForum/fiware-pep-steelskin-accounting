
var config = {};

config.accounting = {
    modules: ['call', 'megabyte', 'second'],

    db: {
        host: 'localhost',
        port: 3306,
        user: 'root',
        passwd: 'root',
        database: 'pep'
    },

    usageAPI: {
        ssl: false,
        host: 'localhost',
        port: '8000',
        path: '/DSUsageManagement/api/usageManagement/v2'
    }
};

module.exports = config;
