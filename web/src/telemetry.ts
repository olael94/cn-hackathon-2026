import { init } from '@dash0/sdk-web'

const url = import.meta.env.VITE_DASH0_ENDPOINT
const authToken = import.meta.env.VITE_DASH0_AUTH_TOKEN

if (url && authToken) {
  init({
    serviceName: 'web',
    serviceVersion: import.meta.env.VITE_APP_VERSION,
    environment: 'hackathon',
    endpoint: { url, authToken },
  })
}
