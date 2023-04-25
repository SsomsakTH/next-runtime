import { makeLocaleOptional, stripLookahead } from '../../packages/runtime/src/helpers/matchers'
import { getEdgeFunctionPatternForPage } from '../../packages/runtime/src/helpers/edge'
const makeDataPath = (path: string) => `/_next/data/build-id${path === '/' ? '/index' : path}.json`

function checkPath(path: string, regex: string) {
  const re = new RegExp(regex)
  const dataPath = makeDataPath(path)
  const testPath = re.test(path)
  const testData = re.test(dataPath)
  //   For easier debugging
  //   console.log({ path, regex, dataPath, testPath, testData })
  return testPath && testData
}

describe('the middleware path matcher', () => {
  it('makes the locale slug optional in the regex for the root', () => {
    // The regex generated by Next for the path "/" with i18n enabled
    const regex =
      '^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/([^/.]{1,}))(|\\.json|\\/?index|\\/?index\\.json)?[\\/#\\?]?$'
    expect(checkPath('/', regex)).toBe(false)
    expect(checkPath('/', makeLocaleOptional(regex))).toBe(true)
    expect(checkPath('/en', makeLocaleOptional(regex))).toBe(true)
  })

  it('makes the locale slug optional in the regex for a subpath', () => {
    // The regex generated by Next for the path "/static" with i18n enabled
    const regex = '^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/([^/.]{1,}))\\/static(.json)?[\\/#\\?]?$'
    expect(checkPath('/static', regex)).toBe(false)
    expect(checkPath('/static', makeLocaleOptional(regex))).toBe(true)
    expect(checkPath('/en/static', makeLocaleOptional(regex))).toBe(true)
  })

  it('does not change the regex when calling makeLocaleOptional with a regex that has no locale', () => {
    const regexes = [
      '^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/(\\/?index|\\/?index\\.json))?[\\/#\\?]?$',
      '^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/api(?:\\/((?:[^\\/#\\?]+?)(?:\\/(?:[^\\/#\\?]+?))*))?(.json)?[\\/#\\?]?$',
      '^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/shows(?:\\/((?!99|88).*))(.json)?[\\/#\\?]?$',
    ]
    for (const regex of regexes) {
      expect(makeLocaleOptional(regex)).toBe(regex)
    }
  })

  it('removes lookaheads from the regex', () => {
    const regexes = [
      '^(?:\\/(_next\\/data\\/[^/]{1,}))?(?:\\/([^/.]{1,}))\\/shows(?:\\/((?!99|88).*))(.json)?[\\/#\\?]?$',
      '^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/shows(?:\\/((?!99|88).*))(.json)?[\\/#\\?]?$',
    ]
    for (const regex of regexes) {
      const stripped = stripLookahead(regex)
      expect(regex).toMatch(/\(\?!/)
      expect(stripped).not.toMatch(/\(\?!/)
    }
  })
  it('converts regexes with lookaheads to stripped ones that still match at least the same paths', () => {
    const regex = '^(?:\\/(_next\\/data\\/[^/]{1,}))?\\/shows(?:\\/((?!99|88).*))(.json)?[\\/#\\?]?$'
    expect(checkPath('/shows', regex)).toBe(false)
    expect(checkPath('/shows/11', regex)).toBe(true)
    expect(checkPath('/shows/99', regex)).toBe(false)
    expect(checkPath('/shows/888', regex)).toBe(false)

    const stripped = stripLookahead(regex)
    expect(checkPath('/shows', stripped)).toBe(false)
    expect(checkPath('/shows/11', stripped)).toBe(true)
    // These will be true because the regex is not as strict as the original one
    // The strict test will be done in the JS entrypoint
    expect(checkPath('/shows/99', stripped)).toBe(true)
    expect(checkPath('/shows/888', stripped)).toBe(true)
  })
})

const pageRegexMap = new Map([
  ['/api/shows/[id]', '^/api/shows/([^/]+?)(?:/)?$'],
  ['/api/shows/[...params]', '^/api/shows/(.+?)(?:/)?$'],
  ['/app-edge/[id]', '^/app\\-edge/([^/]+?)(?:/)?$'],
  ['/blog/[author]', '^/blog/([^/]+?)(?:/)?$'],
  ['/blog/[author]/[slug]', '^/blog/([^/]+?)/([^/]+?)(?:/)?$'],
  ['/getServerSideProps/all/[[...slug]]', '^/getServerSideProps/all(?:/(.+?))?(?:/)?$'],
  ['/getServerSideProps/[id]', '^/getServerSideProps/([^/]+?)(?:/)?$'],
])

const appPathRoutesManifest = {
  '/app-edge/[id]/page': '/app-edge/[id]',
  '/blog/[author]/[slug]/page': '/blog/[author]/[slug]',
  '/blog/[author]/page': '/blog/[author]',
}

describe('the edge function matcher helpers', () => {
  it('finds the correct regex for an edge API route', () => {
    const regex = getEdgeFunctionPatternForPage({
      pageRegexMap,
      appPathRoutesManifest,
      edgeFunctionDefinition: {
        name: 'pages/api/og',
        page: '/api/og',
        env: [],
        files: [],
        matchers: [
          {
            regexp: '^/api/og$',
          },
        ],
        wasm: [],
        assets: [],
      },
    })
    expect(regex).toBe('^/api/og/?$')
    expect('/api/og').toMatch(new RegExp(regex))
    expect('/api/og/').toMatch(new RegExp(regex))
  })

  it('finds the correct regex for an appDir page with a dynamic route', () => {
    const regex = getEdgeFunctionPatternForPage({
      pageRegexMap,
      appPathRoutesManifest,
      edgeFunctionDefinition: {
        env: [],
        files: [],
        name: 'app/app-edge/[id]/page',
        page: '/app-edge/[id]/page',
        matchers: [
          {
            regexp: '^/app\\-edge/(?<id>[^/]+?)$',
          },
        ],
        wasm: [],
        assets: [],
      },
    })
    expect(regex).toBe('^/app\\-edge/([^/]+?)(?:/)?$')
    expect('/app-edge/1').toMatch(new RegExp(regex))
    expect('/app-edge/1/').toMatch(new RegExp(regex))
  })

  it('finds the correct regex for a pages edge route', () => {
    const regex = getEdgeFunctionPatternForPage({
      pageRegexMap,
      appPathRoutesManifest,
      edgeFunctionDefinition: {
        env: [],
        files: [],
        name: 'pages/edge/[id]',
        page: '/edge/[id]',
        matchers: [
          {
            regexp: '^/edge/(?<id>[^/]+?)$',
          },
        ],
        wasm: [],
        assets: [],
      },
    })
    expect(regex).toBe('^/edge/(?<id>[^/]+?)/?$')
    expect('/edge/1').toMatch(new RegExp(regex))
    expect('/edge/1/').toMatch(new RegExp(regex))
  })

  it('finds the correct regex for a pages edge route with a v1 definition', () => {
    const regex = getEdgeFunctionPatternForPage({
      pageRegexMap,
      appPathRoutesManifest,
      edgeFunctionDefinition: {
        env: [],
        files: [],
        name: 'pages/edge/[id]',
        page: '/edge/[id]',
        regexp: '^/edge/(?<id>[^/]+?)$',
        wasm: [],
        assets: [],
      },
    })
    expect(regex).toBe('^/edge/(?<id>[^/]+?)/?$')
    expect('/edge/1').toMatch(new RegExp(regex))
    expect('/edge/1/').toMatch(new RegExp(regex))
  })
})