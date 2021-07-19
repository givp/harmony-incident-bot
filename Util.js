const axios = require('axios')
const _ = require('lodash')
const moment = require('moment')
const pluralize = require('pluralize')

module.exports = class Util {
  constructor() {
    this.incidents = null
    this.rpcIncidents = null
    this.mainnetIncidents = null
    this.testnetIncidents = null
    this.bridgeIncidents = null
    this.since = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
    this.until = new Date().toISOString()
    this.rpcId = 'PZFB95J'
    this.mainnetId = 'PE6T1VU'
    this.testnetId = 'PD5IEJA'
    this.bridgeId = 'P4LXP5X'
    this.rpcDuration = 0
    this.mainnetDuration = 0
    this.testnetDuration = 0
    this.bridgeDuration = 0
    this.averageUptimePercent = 100
  }

  getMinutes (start, end) {
    return Math.round(moment(start).diff(moment(end), 'minutes', true))
  }

  filterByService (serviceId) {
    const vm = this
    const filteredService = _.filter(
      vm.incidents, function (i) {
        return i.service.id === serviceId
      }
    )

    return filteredService
  }

  formatService (service, incidents) {
    const vm = this
    let title
    let description
    let duration

    switch (service) {
      case 'rpc':
        title = 'RPC incidents'
        description = 'Degregated performance'
        duration = vm.rpcDuration
        break
      case 'mainnet':
        title = 'Mainnet incidents'
        description = 'Consensus stuck'
        duration = vm.mainnetDuration
        break;
      case 'testnet':
        title = 'Testnet incidents'
        description = 'Consensus stuck'
        duration = vm.testnetDuration
        break;
      case 'bridge':
        title = 'Bridge incidents'
        description = 'Degregated performance'
        duration = vm.bridgeDuration
        break;
    }

    let durationRange = `${Math.floor(duration / 60)} ${pluralize('hour', Math.floor(duration / 60))} & ${duration % 60 } ${pluralize('minute', duration % 60)}`
    if (Math.floor(duration / 60) < 1) {
      durationRange = `${duration % 60 } ${pluralize('minute', duration % 60)}`
    }
    if (duration % 60 < 1) {
      durationRange = `${Math.floor(duration / 60)} ${pluralize('hour', Math.floor(duration / 60))}`
    }

    let body = `**${title} (${moment(this.since).format('D MMM YYYY')} - ${moment(this.until).format('D MMM YYYY')})**\n`
    body += `Total number of incidents: (${incidents.length }) - ${description} for ${durationRange}\n\n`

    _.each(incidents, function (i) {
      body += `- ${moment(i.last_status_change_at).format('D MMM YYYY')} at ${moment(i.created_at).format('hh:mm a')} UTC (${i.duration} mins)\n`
    })

    body += `\n\n`

    return body
  }

  async sendStatus () {
    await this.getIncidents()

    let body = `Average uptime for ${moment(this.since).format('D MMM YYYY')} - ${moment(this.until).format('D MMM YYYY')}: **${this.averageUptimePercent}%**\n\n`

    if (this.rpcIncidents && this.rpcIncidents.length) {
      body += this.formatService('rpc', this.rpcIncidents)
    }

    if (this.mainnetIncidents && this.mainnetIncidents.length) {
      body += this.formatService('mainnet', this.mainnetIncidents)
    }

    if (this.testnetIncidents && this.testnetIncidents.length) {
      body += this.formatService('testnet', this.testnetIncidents)
    }

    if (this.bridgeIncidents && this.bridgeIncidents.length) {
      body += this.formatService('bridge', this.bridgeIncidents)
    }

    if (body.length < 1) {
      return null
    }

    // send to Discord
    await axios.post(process.env.DISCORD_WEBHOOK, {
      content: body
    })
  }

  async getIncidents () {
    const vm = this
    const params = {
      limit: 100,
      total: true,
      // time_zone: 'America/Los_Angeles',
      service_ids: [vm.rpcId, vm.mainnetId, vm.testnetId, vm.bridgeId],
      since: vm.since,
      until: vm.until
    }

    const response = await axios.get('https://api.pagerduty.com/incidents', {
      headers: {
        authorization: `Token token=${process.env.PD_TOKEN}`
      },
      params
    })

    const incidents = response.data.incidents

    // Add duration
    _.map(incidents, function (row) {
      row.duration = vm.getMinutes(row.last_status_change_at, row.created_at)
    })

    // Remove small incidents
    _.remove(incidents, function (row) {
      return row.duration < 2 || row.duration > 60
    })

    vm.incidents = incidents

    // filter incidents
    vm.rpcIncidents = vm.filterByService(vm.rpcId)
    vm.mainnetIncidents = vm.filterByService(vm.mainnetId)
    vm.testnetIncidents = vm.filterByService(vm.testnetId)
    vm.bridgeIncidents = vm.filterByService(vm.bridgeId)

    // get total duration for each service
    vm.rpcDuration = _.sumBy(vm.rpcIncidents, function (o) { return o.duration })
    vm.mainnetDuration = _.sumBy(vm.mainnetIncidents, function (o) { return o.duration })
    vm.testnetDuration = _.sumBy(vm.testnetIncidents, function (o) { return o.duration })
    vm.bridgeDuration = _.sumBy(vm.bridgeIncidents, function (o) { return o.duration })

    // get overall uptime
    const periodMinutes = vm.getMinutes(vm.until, vm.since)

    const rpcUptime = 100 - (vm.rpcDuration / periodMinutes * 100)
    const mainnetUptime = 100 - (vm.mainnetDuration / periodMinutes * 100)
    const testnetUptime = 100 - (vm.testnetDuration / periodMinutes * 100)
    const bridgeUptime = 100 - (vm.bridgeDuration / periodMinutes * 100)

    vm.averageUptimePercent = ((rpcUptime + mainnetUptime + testnetUptime + bridgeUptime) / 4).toFixed(2)
  }
}
