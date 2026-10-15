export type ProjectId = 'yanyuetong' | 'caiyuntai'

export type ReadmeInline = {
  text: string
  code?: boolean
  strong?: boolean
}

export type ReadmeBlock =
  | { type: 'paragraph'; content: ReadmeInline[] }
  | { type: 'heading'; level: 2 | 3; text: string }
  | { type: 'quote'; content: ReadmeInline[] }
  | { type: 'list'; items: ReadmeInline[][] }
  | { type: 'table'; headers: string[]; rows: ReadmeInline[][][] }
  | { type: 'code'; language: string; code: string }
  | { type: 'image'; src: string; alt: string; caption?: string }

export type ProjectFile = {
  name: string
  kind: 'folder' | 'markdown' | 'maven' | 'config'
}

export type ProjectOverview = {
  id: ProjectId
  name: string
  subtitle: string
  repository: string
  branch: string
  rootFiles: ProjectFile[]
  readme: ReadmeBlock[]
}

const text = (value: string): ReadmeInline => ({ text: value })
const code = (value: string): ReadmeInline => ({ text: value, code: true })
const strong = (value: string): ReadmeInline => ({ text: value, strong: true })

export const projects: ProjectOverview[] = [
  {
    id: 'yanyuetong',
    name: '研约通',
    subtitle: '高校实验资源预约平台',
    repository: 'rys888/yanyuetong',
    branch: 'master',
    rootFiles: [
      { name: 'docs', kind: 'folder' },
      { name: 'frontend', kind: 'folder' },
      { name: 'scripts', kind: 'folder' },
      { name: 'src', kind: 'folder' },
      { name: 'README.md', kind: 'markdown' },
      { name: 'pom.xml', kind: 'maven' },
      { name: '.gitignore', kind: 'config' },
    ],
    readme: [
      {
        type: 'quote',
        content: [
          text('面向高校实验室场景的实验资源预约平台。以 '), code('Redis Lua'),
          text(' 原子准入、'), code('RabbitMQ'),
          text(' 异步落库与定时对账自愈，在单体架构下实现不超卖、不丢单、可自愈。'),
        ],
      },
      { type: 'heading', level: 2, text: '项目简介' },
      {
        type: 'paragraph',
        content: [text('研约通面向高校实验室开放预约场景：管理员为设备创建限定开放时段与名额的预约批次，学生在时段内提交预约。技术选型刻意克制，使用单体应用、Maven 与单库，只引入 Redis 和 RabbitMQ 两个中间件。')],
      },
      {
        type: 'table',
        headers: ['要求', '实现要点'],
        rows: [
          [[strong('不超卖')], [code('Redis Lua'), text(' 原子完成校验、扣名额与去重，数据库唯一索引和条件更新兜底')]],
          [[strong('不丢单')], [text('请求先以 '), code('PRE_ACCEPTED'), text(' 落库，再异步持久化并确认发布')]],
          [[strong('可自愈')], [text('定时对账扫描非终态请求，自动回滚名额、重新投递或转入死信')]],
        ],
      },
      { type: 'heading', level: 2, text: '技术栈' },
      {
        type: 'table',
        headers: ['层次', '选型', '版本 / 说明'],
        rows: [
          [[text('语言')], [strong('Java')], [text('8')]],
          [[text('框架')], [strong('Spring Boot')], [text('2.3.12.RELEASE')]],
          [[text('ORM')], [strong('MyBatis-Plus')], [text('3.4.3')]],
          [[text('缓存 / 锁')], [strong('Redis · Redisson')], [text('Lettuce + 看门狗续期')]],
          [[text('消息队列')], [strong('RabbitMQ')], [text('Direct Exchange · 手动 ack · 死信队列')]],
          [[text('数据 / 构建')], [strong('MySQL · Maven')], [text('单库 · Maven ≥ 3.6')]],
        ],
      },
      { type: 'heading', level: 2, text: '核心预约流程' },
      { type: 'paragraph', content: [text('预约提交把请求记账、Redis 临界区、消息投递和数据库持久化串成一条可追踪链路：')] },
      {
        type: 'code',
        language: 'text',
        code: `POST /reservation
  1. 写入 reservation_request = PRE_ACCEPTED
  2. Lua: 校验时段 / 名额 / 重复预约 → DECR + SADD
  3. RabbitMQ publisher-confirm → PUBLISHED
  4. Consumer 在事务内写入 reservation
  5. CAS → CONFIRMED；失败进入 DLQ / Reconcile`,
      },
      { type: 'heading', level: 3, text: '为什么先记账再投递' },
      {
        type: 'list',
        items: [
          [strong('临界区收在 Lua 中：'), text('名额、时段和重复校验不可被并发请求拆开。')],
          [strong('请求表提供故障凭据：'), text('即使 Redis 扣减后进程中断，对账任务仍能发现并收口。')],
          [strong('数据库是最后防线：'), text('唯一索引和条件更新继续阻止重复占用。')],
        ],
      },
      { type: 'heading', level: 2, text: '快速开始' },
      {
        type: 'code',
        language: 'shell',
        code: `# JDK 8 · Maven 3.6+ · MySQL · Redis · RabbitMQ
mvn spring-boot:run

# application listens on :8081`,
      },
    ],
  },
  {
    id: 'caiyuntai',
    name: '采云台',
    subtitle: '企业办公物资申领与采购管理平台',
    repository: 'rys888/caiyuntai',
    branch: 'main',
    rootFiles: [
      { name: 'backend/cai-yun-tai', kind: 'folder' },
      { name: 'front', kind: 'folder' },
      { name: 'interface', kind: 'folder' },
      { name: 'README.md', kind: 'markdown' },
      { name: '采云台-项目地图.md', kind: 'markdown' },
      { name: '.gitignore', kind: 'config' },
    ],
    readme: [
      {
        type: 'quote',
        content: [
          text('基于 '), code('Spring Boot'), text('、'), code('MyBatis'), text('、'),
          code('MySQL'), text(' 与 '), code('Redis'),
          text(' 构建的企业办公物资申领与采购管理平台。'),
        ],
      },
      { type: 'heading', level: 2, text: '项目简介' },
      {
        type: 'paragraph',
        content: [
          text('采云台将员工申请、人工审批、采购与发放流程线上化，围绕员工申领、部门预算、采购审批、物资管理和配送核销展开，区分 '),
          code('EMPLOYEE'), text('、'), code('PURCHASER'), text('、'), code('ADMIN'), text(' 三类角色。'),
        ],
      },
      {
        type: 'paragraph',
        content: [text('项目重点在后端的一致性与并发安全：JWT + Redis 登录态、AOP 角色鉴权、部门预算并发控制、Cache-Aside 缓存、事务控制与重复提交防护。')],
      },
      { type: 'heading', level: 2, text: '技术栈' },
      {
        type: 'table',
        headers: ['分类', '技术选型'],
        rows: [
          [[text('后端')], [strong('Spring Boot 2.7.3'), text(' · Spring MVC · MyBatis 2.2.0')]],
          [[text('数据')], [strong('MySQL · Redis'), text(' · PageHelper · Druid')]],
          [[text('认证权限')], [strong('JJWT'), text(' · HandlerInterceptor · ThreadLocal · Spring AOP')]],
          [[text('接口文档')], [strong('Knife4j 3.0.2'), text('（Swagger 2）')]],
          [[text('前端')], [text('原生 HTML / CSS / JavaScript（无构建步骤）')]],
          [[text('运行环境')], [text('JDK 8 · Maven 3.6+ · MySQL 8.0+ · Redis 6+')]],
        ],
      },
      { type: 'heading', level: 2, text: '核心业务流程' },
      {
        type: 'code',
        language: 'text',
        code: `员工申领 → 服务端重新计价 → 部门预算预扣
        → 生成主单与明细 → 采购审批
        → 采购 / 配送 → 员工确认收货 → 核销完成`,
      },
      { type: 'heading', level: 2, text: '核心技术设计' },
      {
        type: 'list',
        items: [
          [strong('双端认证：'), text('管理端与员工端使用独立拦截器、请求头和 SecretKey，Redis 白名单支持主动注销。')],
          [strong('预算并发控制：'), text('带余额条件的 MySQL UPDATE 把额度判断与预扣合并为原子操作。')],
          [strong('事务与幂等：'), code('@Transactional'), text(' 覆盖预算、主单、明细与申领车；'), code('SET NX'), text(' 拦截短期重复提交。')],
          [strong('Cache-Aside：'), text('随机 TTL 分散集中失效，空结果短 TTL，写入后主动删除相关缓存。')],
        ],
      },
      { type: 'heading', level: 3, text: '角色与权限' },
      {
        type: 'table',
        headers: ['能力', 'EMPLOYEE', 'PURCHASER', 'ADMIN'],
        rows: [
          [[text('浏览与提交申领')], [text('✓')], [text('—')], [text('—')]],
          [[text('审批 / 采购 / 配送 / 核销')], [text('—')], [text('✓')], [text('✓')]],
          [[text('部门、预算与基础数据维护')], [text('—')], [text('—')], [text('✓')]],
        ],
      },
      { type: 'heading', level: 2, text: '本地运行' },
      {
        type: 'code',
        language: 'shell',
        code: `cd backend/cai-yun-tai
mvn clean package
java -jar caiyuntai-server/target/*.jar

# backend :8084 · admin :8082 · staff :8083`,
      },
    ],
  },
]
