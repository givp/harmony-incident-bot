const Util = require('./Util')

exports.handler = async (event) => {
    await new Util().sendStatus()

    const response = {
        statusCode: 200,
        body: 'ok',
    }
    return response
}
