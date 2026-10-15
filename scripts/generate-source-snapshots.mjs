import { readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const repositories = {
  yanyuetong: {
    root: '/Users/eason/Desktop/yanyuetong',
    github: 'https://github.com/rys888/yanyuetong/blob/master',
  },
  caiyuntai: {
    root: '/Users/eason/Desktop/caiyuntai',
    github: 'https://github.com/rys888/caiyuntai/blob/main',
  },
}

const manifest = [
  { projectId: 'yanyuetong', path: 'README.md', language: 'markdown' },
  { projectId: 'yanyuetong', path: 'pom.xml', language: 'xml' },
  { projectId: 'yanyuetong', path: 'src/main/resources/reservation.lua', language: 'lua' },
  { projectId: 'yanyuetong', path: 'src/main/resources/mapper/ReservationMapper.xml', language: 'xml' },
  { projectId: 'yanyuetong', path: 'src/main/java/com/yanyuetong/utils/ReservationQuotaExecutor.java', language: 'java' },
  { projectId: 'yanyuetong', path: 'src/main/java/com/yanyuetong/service/impl/ReservationLifecycleServiceImpl.java', language: 'java' },
  { projectId: 'yanyuetong', path: 'src/main/java/com/yanyuetong/mq/ReservationMessageConsumer.java', language: 'java' },
  { projectId: 'yanyuetong', path: 'src/main/java/com/yanyuetong/service/impl/ReservationReconcileServiceImpl.java', language: 'java' },
  { projectId: 'yanyuetong', path: 'src/main/java/com/yanyuetong/utils/CacheClient.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-common/src/main/java/com/caiyuntai/utils/JwtUtil.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'README.md', language: 'markdown' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/pom.xml', language: 'xml' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-common/pom.xml', language: 'xml' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-pojo/pom.xml', language: 'xml' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/pom.xml', language: 'xml' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/src/main/java/com/caiyuntai/interceptor/JwtTokenUserInterceptor.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/src/main/java/com/caiyuntai/aspect/RoleAspect.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/src/main/java/com/caiyuntai/service/impl/BudgetServiceImpl.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/src/main/java/com/caiyuntai/controller/user/ComboController.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/src/main/resources/mapper/BudgetMapper.xml', language: 'xml' },
]

const references = [
  { projectId: 'yanyuetong', path: 'src/main/java/com/yanyuetong/mq/ReservationDlqConsumer.java', language: 'java' },
  { projectId: 'caiyuntai', path: 'backend/cai-yun-tai/caiyuntai-server/src/main/java/com/caiyuntai/service/impl/OrderServiceImpl.java', language: 'java' },
]

const forbidden = [
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
  /(?:password|access[-_]?key|api[-_]?key)\s*[:=]\s*["'][^"']+["']/i,
  /(?:jdbc|redis):\/\/[^\s"']+:[^\s"']+@/i,
]

const snapshots = []
for (const item of manifest) {
  const repository = repositories[item.projectId]
  const content = await readFile(resolve(repository.root, item.path), 'utf8')
  if (forbidden.some((pattern) => pattern.test(content))) {
    throw new Error(`Sensitive-looking content rejected: ${item.projectId}/${item.path}`)
  }
  snapshots.push({
    ...item,
    name: item.path.split('/').at(-1),
    content,
    available: true,
    githubUrl: `${repository.github}/${item.path.split('/').map(encodeURIComponent).join('/')}`,
  })
}

for (const item of references) {
  const repository = repositories[item.projectId]
  snapshots.push({
    ...item,
    name: item.path.split('/').at(-1),
    content: '',
    available: false,
    githubUrl: `${repository.github}/${item.path.split('/').map(encodeURIComponent).join('/')}`,
  })
}

await writeFile(
  resolve(projectRoot, 'src/data/sourceSnapshots.json'),
  `${JSON.stringify(snapshots, null, 2)}\n`,
  'utf8',
)

console.log(`Generated ${snapshots.length} source entries (${manifest.length} embedded, ${references.length} linked).`)
