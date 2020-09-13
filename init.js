const fs = require('fs');
const db = require('./src/db')

let config = JSON.parse(fs.readFileSync('./src/config.json'))

const setPluginStatus = (pluginName, enable) => {
    switch (enable) {
        case 'false':
            let index = config['plugins'].indexOf(pluginName)
            if (index > -1)
                config['plugins'].splice(index, 1)
            console.log(`Plugin ${pluginName} is disabled`)
            break;
        case 'true':
            db.init()
            return db.pluginExists(pluginName).then(exists => {
                if (!exists) {
                    console.error(`\x1b[31mPlugin ${pluginName} ` + 
                        `does not exists in database\x1b[0m`)
                    return
                }
                let filenames = fs.readdirSync('./static/')
                if (!filenames.some(name => name == pluginName)) {
                    console.error(`\x1b[31mFolder for plugin ${pluginName} ` + 
                        `does not exists in static/\x1b[0m`)
                    return
                }
                if (config['plugins'].indexOf(pluginName) < 0)
                    config['plugins'].push(pluginName)
                console.log(`Plugin ${pluginName} is enabled`)
            })
            break;
        default:
            console.error(`\x1b[31mIncorrect value ${enable}`+
                ' for argument enable\x1b[0m')
            break;
    }
}

const initPlugin = (pluginName, clientId, clientSecret, enable) => {
    if (!enable) enable = 'true'
    if (!clientId ^ !clientSecret) {
        console.error(`\x1b[31mExpected argument ${clientId ? 
            'client_secret':'client_id'}\x1b[0m`)
        return
    }
    if (!clientId) {
        return setPluginStatus(pluginName, enable)
    }
    db.init()
    return db.addPlugin(pluginName, clientId, clientSecret).then(()=>{
        console.log(`Plugin ${pluginName} added in databese`)
        return setPluginStatus(pluginName, enable)
    })
}

const initDbLogin = (dbUser, dbPass) => {
    config['db_user'] = dbUser
    config['db_pass'] = dbPass
    console.log('Database login initialized')
}

const list = async () => {
    console.log('Enabled plugins:')
    config['plugins'].forEach(name => console.log('\t' + name))
}

scripts = {
    'plugin': {
        required: ['plugin_name'],
        free: ['client_id', 'client_secret', 'enable'],
        handler: initPlugin
    },
    'database': {
        required: ['db_user', 'db_pass'],
        free: [],
        handler: initDbLogin
    },
    'list': {
        required: [],
        free: ['ls'],
        handler: list
    }
}

actives = new Set()
values = []

process.argv.slice(2).forEach((val, idx, arr) => {
    let name = val.split('=')[0]
    let value = val.split('=')[1]
    if (!Object.values(scripts)
        .reduce((acc, val) => 
            acc |= val.required
                .concat(val.free)
                .some(e => e == name), false)) {
        console.error(`\x1b[31mUnknown argument: ${name}\x1b[0m`)
        process.exit()
    }
    Object.keys(scripts).forEach(initType => {
        if (!scripts[initType].required
                .concat(scripts[initType].free)
                .some(e => e == name)) 
            return;
        actives.add(initType)
        values[name] = value
    })
})

promises = []

actives.forEach(script => {
    params = scripts[script].required.map(arg => {
        if (values[arg] == undefined) {
            console.error(`\x1b[31mMissing argument for ` + 
                `${script} initialize: ${arg}\x1b[0m`)
            process.exit()
        }
        return values[arg]
    }).concat(scripts[script].free.map(arg => values[arg]))
    promises.push(scripts[script].handler(...params))
})

Promise.all(promises).then(() => {
    fs.writeFileSync('./src/config.json', JSON.stringify(config, null, '\t'))
})
