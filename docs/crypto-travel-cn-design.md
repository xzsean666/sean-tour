# Sean Tour 方案文档（Crypto 中国旅行）

## 1. 目标

打造一个“可使用 Crypto 支付的中国旅行服务平台”，首期覆盖 4 类核心服务：

1. 旅游套餐（按城市/主题打包）
2. 专业导游（多语种）
3. 带司机包车（多座位车型）
4. 远程中国小助手（人工远程支持）

支付约束（MVP）：

1. 仅支持 Crypto 支付
2. 首版仅支持 `USDT`
3. 仅支持 `ERC20` 网络，首发链固定 `BSC (chainId=56)`

## 2. 技术约束（按现有仓库）

1. 前端：`Vue 3 + Vite + PrimeVue + Tailwind`
2. 后端：`NestJS + GraphQL`
3. 数据：统一使用 `backend/src/common/db.service.ts` 的 KV 能力
4. 存储格式：KV value 统一 JSON，不引入关系型建模

## 3. MVP 用户流程

1. 用户注册/登录
2. 浏览服务（套餐/导游/包车/小助手）
3. 选择服务并创建预订
4. 生成 `USDT(BSC/ERC20)` 支付单并支付
5. 支付确认后订单进入确认流程
6. 用户查看订单详情并与服务方对接

## 4. 前端页面设计（信息架构）

### 4.1 路由建议（精简版）

1. `/` 首页（服务聚合页，合并原 `/services`）
2. `/packages` 套餐列表
3. `/packages/:id` 套餐详情
4. `/guides` 导游列表
5. `/guides/:id` 导游详情
6. `/cars` 包车列表
7. `/cars/:id` 包车详情
8. `/assistant` 远程小助手介绍页
9. `/assistant/requests` 远程小助手用户工作台
10. `/checkout/:bookingId` 结算页（USDT/BSC/ERC20）
11. `/orders` 我的订单
12. `/orders/:id` 订单详情
13. `/profile` 用户资料页
14. `/faq` 常见问题
15. `/support` 客服支持
16. `/admin/access` 运营账号授权入口
17. `/admin/services` 服务录入与排班面板
18. `/admin/payments` 支付事件观测台
19. `/admin/orders` 订单运营台
20. `/admin/assistant` 小助手运营台
21. `/admin/support` 客服工作台（客服账号分配、激活状态、会话处理）

### 4.2 页面重点

1. 首页：统一入口 + 四类服务卡片 + 多语引导
2. 列表页：城市/语言/日期/价格筛选 + 分页
3. 详情页：服务范围、取消规则、可约时间、下单按钮
4. 结算页：USDT 固定计价金额、BSC 网络、支付倒计时、轮询状态
5. 订单页：预订状态 + 支付状态 + 联系信息 + 服务凭证
6. 用户客服页：仅展示当前登录用户自己的会话历史、输入框、常见问题快捷入口
7. 客服工作台：左侧会话列表，右侧消息面板，顶部客服激活开关与当前接待数

### 4.3 组件拆分建议

1. `ServiceCard`
2. `FilterBar`
3. `CryptoPayPanel`
4. `BookingSummary`
5. `OrderStatusTimeline`
6. `PagePagination`
7. `SupportConversationList`
8. `SupportMessagePanel`
9. `SupportAgentStatusSwitch`

## 5. 后端模块设计（NestJS）

按领域组织：`module + resolver + service + dto`。

1. `catalog`：服务查询与详情
2. `booking`：预订创建、状态流转
3. `payment`：USDT(BSC/ERC20) 支付单创建与状态更新
4. `assistant`：远程助手排班与会话
5. `order`：订单聚合查询
6. `user`：用户资料（护照/联系方式等）
7. `notification`：通知发送（站内/邮件）
8. `support`：客服会话、消息、客服账号状态与分配
9. `admin`：后台录入与运营接口

### 5.1 Auth 衔接（复用现有实现）

直接复用已有 `backend/src/auth` 体系（`AuthGuard`、`CurrentUser`、`AuthModule`）：

1. GraphQL 请求使用 `Authorization: Bearer <token>`
2. 需要登录的 Resolver 统一加 `@UseGuards(AuthGuard)`
3. 在 Resolver 通过 `@CurrentUser()` 取用户信息
4. `booking.userId` 统一来自 token 解出的 `user_id`，不允许前端传入
5. 管理端接口统一走 backend 角色判权：`@UseGuards(AdminGuard)` + `currentUser.is_admin`，浏览器端不再持有 admin auth code
6. 管理员名单支持两层来源：`ADMIN_USER_IDS/ADMIN_USER_EMAILS` 作为 bootstrap 只读管理员，运行期新增/停用的管理员通过 `/admin/access` 写入统一的 `role_access` 记录到 `travel_kv`
7. `ADMIN_AUTH_CODE` 仅保留给 callback/sync/脚本等 server-to-server 入口兜底，不再作为浏览器管理页的主鉴权方式
8. `currentUser` 需要返回最小角色态（至少 `is_admin`、`is_support_agent`），用于前端导航和路由守卫收口后台/客服入口

### 5.2 简单客服模式（MVP）

以下默认按“客服账号激活后加入自动分配池”设计，而不是普通客户激活。

1. 任意已注册并登录用户都可以进入 `/support` 与客服发消息。
2. 为保持实现简单，MVP 采用“一用户一条长期客服会话”模型，按 `userId` 唯一归档全部聊天历史。
3. 管理员可把已有注册账号标记为 `support agent`，只有被标记的账号才可进入 `/admin/support`。
4. 客服账号存在两个状态：`enabled` 表示具备客服权限，`isActive` 表示当前参与自动分配。
5. 用户首次发消息时，如果尚未分配客服，系统从 `isActive=true` 的客服池里按 `openConversationCount asc + lastAssignedAt asc` 选择一个客服自动分配。
6. 如果当下没有激活客服，会话进入 `WAITING_AGENT`；一旦有客服账号被激活，系统优先把最早的待接待会话自动补分配出去。
7. 所有客服账号共享同一套客户聊天记录；`assignedAgentId` 只用于默认责任归属、工作台筛选和负载统计，不阻止其他客服查看历史并继续回复。
8. 普通用户只能读取自己的会话和消息；客服与管理员可以读取全部客服会话，但工作台默认展示“分配给我”和“待分配”。
9. 管理员必须支持手动改派客服账号，以便处理请假、交接和高优先级用户。
10. 账号授权入口统一收口到 `/admin/access`：`/admin/support` 只负责队列处理、会话改派和客服本人 `isActive` 开关，不再承担账号授予入口。
11. `support agent` 授权记录需要保留 `note/grantedBy/updatedBy`，保证谁在什么背景下开通或停用了客服账号可追溯。
12. 后端角色存储统一走 `role_access:{role}:{recordId}`；其中客服权限属于 `SUPPORT_AGENT` 角色，客服在线/离线与最近分配时间等运行态单独写入 `support_agent_state:{userId}`。
13. 迁移兼容期内，历史 `admin_access:*` 与 `support_agent:*` 只保留只读兼容，不再作为新写入目标。
14. 客服工作台至少要支持按 `unreadForAgents` / `unreadForUser` 做未读筛选，方便快速定位“用户刚发来还没被处理”与“客服已回复等待用户”的会话。
15. 内部备注、关闭原因这类仅供客服/运营协作的信息，必须存放在独立的 workspace meta 中，不能直接暴露到用户侧 `SupportConversation` 查询结果。
16. workspace meta 还需要承载 `priority/tags` 这类运营分诊字段；默认优先级为 `NORMAL`，并基于“最近一条待客服处理消息”的时间自动计算 `slaDueAt/slaStatus`，用于客服队列预警。
17. 改派、triage、内部备注、标记已解决、关闭、重开这类会话级运营动作必须额外写入 `support_conversation_audit:*`，客服工作台要能按会话查看历史轨迹，并至少支持按 `actor/action` 过滤与导出。
18. 客服工作台建议内置快捷回复模板和常用标签建议，用户侧 `/support` 建议提供常见问题起手模板，减少重复输入。
19. 客服工作台的核心队列筛选条件、分页位置、当前选中会话和 audit 过滤条件，建议同步到 URL query，方便运营直接分享“待客服处理 / 已解决 / 已关闭”的工作台视图。

## 6. GraphQL API 草案（含分页与服务类型区分）

```graphql
enum ServiceType {
  PACKAGE
  GUIDE
  CAR
  ASSISTANT
}

enum BookingStatus {
  PENDING_PAYMENT
  PAID
  CONFIRMED
  IN_SERVICE
  COMPLETED
  CANCELED
  REFUNDING
  REFUNDED
}

enum PaymentStatus {
  PENDING
  PARTIALLY_PAID
  PAID
  UNDERPAID
  EXPIRED
  REFUNDING
  REFUNDED
}

input PageInput {
  limit: Int = 10
  offset: Int = 0
}

input ServiceListInput {
  type: ServiceType
  city: String
  language: String
  page: PageInput
}

input BookingListInput {
  status: BookingStatus
  page: PageInput
}

type ServicePage {
  items: [ServiceItem!]!
  total: Int!
  limit: Int!
  offset: Int!
  hasMore: Boolean!
}

type BookingPage {
  items: [Booking!]!
  total: Int!
  limit: Int!
  offset: Int!
  hasMore: Boolean!
}

type PackageServiceDetail {
  durationDays: Int!
  itinerary: [String!]!
}

type GuideServiceDetail {
  languages: [String!]!
  yearsOfExperience: Int!
  certifications: [String!]!
}

type CarServiceDetail {
  seats: Int!
  carType: String!
  luggageCapacity: String
}

type AssistantServiceDetail {
  supportChannels: [String!]!
  serviceHours: String!
}

union ServiceDetail =
    PackageServiceDetail
  | GuideServiceDetail
  | CarServiceDetail
  | AssistantServiceDetail

type Query {
  serviceList(input: ServiceListInput!): ServicePage!
  serviceDetail(id: ID!): ServiceDetail!
  myBookings(input: BookingListInput!): BookingPage!
  bookingDetail(bookingId: ID!): Booking!
}

type Mutation {
  createBooking(input: CreateBookingInput!): Booking!
  createUsdtPayment(input: CreateUsdtPaymentInput!): PaymentIntent!
  cancelBooking(bookingId: ID!, reason: String): Booking!
  requestAssistantSession(input: RequestAssistantSessionInput!): AssistantSession!

  adminUpsertService(input: AdminUpsertServiceInput!): ServiceItem!
  adminSetServiceStatus(input: SetServiceStatusInput!): ServiceItem!
}
```

`CreateUsdtPaymentInput` 建议字段：

1. `bookingId: ID!`

MVP 约束：

1. 不接受客户端传入 `token/network`
2. 后端写死：`token=USDT`、`network=BSC`、`tokenStandard=ERC20`

当前实现补充说明：

1. `catalog` 还额外提供 `serviceItem`、`adminDeleteService`、`adminServiceAuditLogs`
2. `payment` 还提供 `paymentByBooking`、`adminUpdatePaymentStatus`、`adminPaymentEvents`
3. `order` 已落地 `myOrders / orderDetail / adminOrders`
4. `assistant` 已落地 `myAssistantSessions / assistantSessionDetail / adminAssistantSessions / adminUpdateAssistantSession / adminBatchAssignAssistantSessions`
5. `user + notification` 已落地 `myProfile / upsertMyProfile / exportMyData / deleteMyData / myNotifications / markNotificationRead`
6. `booking` 已落地 `adminAssignableBookingResources / adminServiceResourceSchedule / adminUpdateBookingStatus / adminReassignBookingResource`
7. `support` 已超出 MVP 草案，详见下方 6.1 专节

### 6.1 客服补充 API（MVP）

```graphql
enum SupportConversationStatus {
  WAITING_AGENT
  IN_PROGRESS
  WAITING_USER
  RESOLVED
  CLOSED
}

enum SupportConversationPriority {
  LOW
  NORMAL
  HIGH
  URGENT
}

enum SupportConversationSlaStatus {
  ON_TRACK
  DUE_SOON
  OVERDUE
}

enum SupportConversationAuditAction {
  USER_MESSAGE
  AGENT_REPLY
  ASSIGNED
  INTERNAL_NOTE_UPDATED
  TRIAGE_UPDATED
  RESOLVED
  CLOSED
  REOPENED
}

enum SupportSenderRole {
  USER
  SUPPORT_AGENT
  SYSTEM
}

input SupportConversationListInput {
  conversationId: ID
  status: SupportConversationStatus
  priority: SupportConversationPriority
  assignedAgentId: ID
  userId: ID
  hasUnreadForUser: Boolean
  hasUnreadForAgents: Boolean
  page: PageInput
}

input SendSupportMessageInput {
  content: String!
}

input ReplySupportConversationInput {
  conversationId: ID!
  content: String!
}

input ResolveSupportConversationInput {
  conversationId: ID!
}

input SetSupportConversationInternalNoteInput {
  conversationId: ID!
  internalNote: String
}

input SetSupportConversationTriageInput {
  conversationId: ID!
  priority: SupportConversationPriority
  tags: [String!]
}

input AdminCloseSupportConversationInput {
  conversationId: ID!
  closeReason: String
}

type SupportAgent {
  userId: ID!
  displayName: String
  email: String
  enabled: Boolean!
  isActive: Boolean!
  openConversationCount: Int!
  lastAssignedAt: DateTime
}

type SupportMessage {
  id: ID!
  conversationId: ID!
  senderUserId: ID!
  senderRole: SupportSenderRole!
  content: String!
  createdAt: DateTime!
}

type SupportConversation {
  id: ID!
  userId: ID!
  assignedAgentId: ID
  sharedAgentIds: [ID!]!
  status: SupportConversationStatus!
  lastMessagePreview: String
  lastMessageAt: DateTime
  unreadForUser: Int!
  unreadForAgents: Int!
  messages(limit: Int = 50, offset: Int = 0): [SupportMessage!]!
}

type SupportConversationPage {
  items: [SupportConversation!]!
  total: Int!
  limit: Int!
  offset: Int!
  hasMore: Boolean!
}

type SupportConversationWorkspaceMeta {
  conversationId: ID!
  internalNote: String
  priority: SupportConversationPriority!
  tags: [String!]!
  closeReason: String
  closedAt: DateTime
  closedBy: String
  updatedAt: DateTime!
  updatedBy: String
  slaDueAt: DateTime
  slaStatus: SupportConversationSlaStatus
}

type SupportConversationAudit {
  id: ID!
  conversationId: ID!
  action: SupportConversationAuditAction!
  actor: String!
  summary: String!
  messagePreview: String
  priority: SupportConversationPriority
  tags: [String!]!
  assignedAgentId: ID
  closeReason: String
  reopenedFromStatus: SupportConversationStatus
  createdAt: DateTime!
}

type SupportConversationAuditPage {
  items: [SupportConversationAudit!]!
  total: Int!
  limit: Int!
  offset: Int!
  hasMore: Boolean!
}

extend type Query {
  mySupportConversation: SupportConversation!
  mySupportAgentProfile: SupportAgent!
  supportConversationQueue(input: SupportConversationListInput!): SupportConversationPage!
  supportConversationDetail(conversationId: ID!): SupportConversation!
  supportConversationAuditLogs(
    conversationId: ID!
    actor: String
    action: SupportConversationAuditAction
    page: PageInput
  ): SupportConversationAuditPage!
  adminSupportConversations(input: SupportConversationListInput!): SupportConversationPage!
  adminSupportConversation(conversationId: ID!): SupportConversation!
  adminSupportAgents: [SupportAgent!]!
  supportConversationWorkspaceMeta(conversationId: ID!): SupportConversationWorkspaceMeta!
  supportConversationWorkspaceMetas(conversationIds: [ID!]!): [SupportConversationWorkspaceMeta!]!
}

extend type Mutation {
  sendSupportMessage(input: SendSupportMessageInput!): SupportConversation!
  replySupportConversation(input: ReplySupportConversationInput!): SupportConversation!
  resolveSupportConversation(input: ResolveSupportConversationInput!): SupportConversation!
  setMySupportAgentActive(isActive: Boolean!): SupportAgent!
  setSupportConversationInternalNote(input: SetSupportConversationInternalNoteInput!): SupportConversationWorkspaceMeta!
  setSupportConversationTriage(input: SetSupportConversationTriageInput!): SupportConversationWorkspaceMeta!
  adminSetSupportAgent(input: AdminSetSupportAgentInput!): SupportAgent!
  adminAssignSupportConversation(input: AdminAssignSupportConversationInput!): SupportConversation!
  adminCloseSupportConversation(input: AdminCloseSupportConversationInput!): SupportConversation!
}
```

说明：

1. `mySupportConversation` 对用户侧返回“我的唯一客服会话”；不存在时可在首次发送消息时自动创建。
2. 用户侧统一通过 `sendSupportMessage` 写入消息；客服侧统一通过 `replySupportConversation` 回复，避免普通用户伪造客服角色。
3. `resolveSupportConversation` 只对 `support agent/admin` 开放，用于把当前会话标记为“已解决”；后续用户或客服再次发消息时，会话自动重开并回到活动态。
4. `adminSetSupportAgent` 用于把已有注册账号赋予或移除客服权限；落库写入统一角色授权记录。
5. `setMySupportAgentActive` 用于客服本人值守开关；运行态写入 `support_agent_state:{userId}`，激活后立即触发待分配会话补分配。
6. `supportConversationWorkspaceMeta / supportConversationWorkspaceMetas / setSupportConversationInternalNote / setSupportConversationTriage` 只对 `support agent/admin` 开放，用于共享内部备注、优先级、标签、关闭原因等运营协作信息。
7. `slaDueAt / slaStatus` 不单独持久化，统一由后端基于 `priority + unreadForAgents + lastMessageAt` 动态计算，避免队列展示和详情页出现不一致。
8. `supportConversationAuditLogs` 只对 `support agent/admin` 开放，用于查看会话的操作时间线；消息发送、改派、triage、标记已解决、关闭和重开都要有对应 audit entry，并支持按 `actor/action` 做工作台过滤。
9. `REOPENED` audit entry 需要带 `reopenedFromStatus`，明确这次恢复是从 `RESOLVED` 还是 `CLOSED` 回到活动态，方便客服工作台追踪“重新打开”的触发背景。

## 7. KV 数据模型（单表 + 无手动索引）

建议只开一个业务表：`travel_kv`。  
通过 key 前缀区分实体类型，value 全 JSON。

### 7.1 Key 规范（MVP）

1. `service:{serviceId}`
2. `booking:{bookingId}`
3. `payment:{paymentId}`
4. `assistant_session:{sessionId}`
5. `support_conversation:{conversationId}`
6. `support_message:{messageId}`
7. `support_conversation_meta:{conversationId}`
8. `support_conversation_audit:{auditId}`
9. `role_access:{role}:{recordId}`，例如 `role_access:ADMIN:user:admin_1`、`role_access:SUPPORT_AGENT:user:agent_2`
10. `support_agent_state:{userId}`

兼容迁移说明：

1. 历史 `admin_access:{recordId}` 与 `support_agent:{userId}` 仅保留只读兼容。
2. 新增或更新授权记录时统一写入 `role_access:*`；客服值守状态统一写入 `support_agent_state:*`。
3. 仅客服工作台使用的备注/priority/tags/关闭原因统一写入 `support_conversation_meta:*`，避免与用户可见会话对象混在一起。
4. 会话级操作历史统一写入 `support_conversation_audit:*`，作为客服工作台可追踪时间线数据源。

### 7.2 查询策略（MVP）

按你的建议，MVP 去掉“写时维护索引”，统一走：

1. `searchJson({ contains: ... })` 做主过滤
2. Service 层再做二次过滤（如数组字段、范围过滤）
3. Service 层统一分页（`limit/offset`）

优点：

1. 不会出现“主数据成功、索引失败”导致查不到数据的问题
2. 实现简单，适合 MVP 快速迭代

代价：

1. 数据量大时查询性能下降
2. 后续进入增长期再引入只读索引或搜索引擎

### 7.3 Service JSON 示例

```json
{
  "id": "svc_pkg_001",
  "type": "PACKAGE",
  "title": "北京 3 天文化深度游",
  "city": "Beijing",
  "description": "详细行程说明",
  "images": ["https://example.com/img1.jpg"],
  "basePrice": { "amount": 399, "currency": "USDT" },
  "status": "ACTIVE",
  "capacity": { "min": 1, "max": 6, "remaining": 4 },
  "detail": {
    "__typename": "PackageServiceDetail",
    "durationDays": 3,
    "itinerary": ["Day1", "Day2", "Day3"]
  },
  "updatedAt": "2026-03-03T00:00:00.000Z"
}
```

### 7.4 Booking JSON 示例

```json
{
  "id": "bk_001",
  "userId": "u_001",
  "serviceId": "svc_pkg_001",
  "serviceType": "PACKAGE",
  "startDate": "2026-04-18",
  "endDate": "2026-04-20",
  "travelerCount": 2,
  "status": "PENDING_PAYMENT",
  "cancelReason": "",
  "serviceSnapshot": {
    "title": "北京 3 天文化深度游",
    "basePrice": { "amount": 399, "currency": "USDT" }
  },
  "rating": null,
  "createdAt": "2026-03-03T00:00:00.000Z",
  "updatedAt": "2026-03-03T00:00:00.000Z"
}
```

### 7.5 Payment JSON 示例

```json
{
  "id": "pay_001",
  "bookingId": "bk_001",
  "userId": "u_001",
  "token": "USDT",
  "network": "BSC",
  "tokenStandard": "ERC20",
  "expectedAmount": "798.00",
  "paidAmount": "0.00",
  "payAddress": "0xabc...",
  "txHash": "",
  "confirmations": 0,
  "status": "PENDING",
  "expiredAt": "2026-03-03T00:30:00.000Z",
  "createdAt": "2026-03-03T00:00:00.000Z",
  "updatedAt": "2026-03-03T00:00:00.000Z"
}
```

### 7.6 SupportConversation JSON 示例

```json
{
  "id": "supconv_u_001",
  "userId": "u_001",
  "assignedAgentId": "u_support_003",
  "sharedAgentIds": ["u_support_003", "u_support_005"],
  "status": "IN_PROGRESS",
  "lastMessagePreview": "I need help with my order bk_001",
  "lastMessageAt": "2026-03-14T09:12:00.000Z",
  "unreadForUser": 0,
  "unreadForAgents": 1,
  "createdAt": "2026-03-14T09:00:00.000Z",
  "updatedAt": "2026-03-14T09:12:00.000Z"
}
```

### 7.7 SupportMessage JSON 示例

```json
{
  "id": "supmsg_001",
  "conversationId": "supconv_u_001",
  "userId": "u_001",
  "senderUserId": "u_support_003",
  "senderRole": "SUPPORT_AGENT",
  "content": "Your payment is confirmed. We are checking the booking now.",
  "createdAt": "2026-03-14T09:12:00.000Z"
}
```

### 7.8 SupportAgent JSON 示例

```json
{
  "userId": "u_support_003",
  "enabled": true,
  "isActive": true,
  "openConversationCount": 12,
  "lastAssignedAt": "2026-03-14T09:10:00.000Z",
  "updatedAt": "2026-03-14T09:10:00.000Z"
}
```

## 8. 状态机（完善版）

### 8.1 Booking

1. `PENDING_PAYMENT -> PAID -> CONFIRMED -> IN_SERVICE -> COMPLETED`
2. `PENDING_PAYMENT -> CANCELED`
3. `PAID -> REFUNDING -> REFUNDED`

### 8.2 Payment

1. `PENDING -> PARTIALLY_PAID -> PAID`
2. `PENDING -> EXPIRED`
3. `PENDING|PARTIALLY_PAID -> UNDERPAID`
4. `PAID -> REFUNDING -> REFUNDED`

### 8.3 SupportConversation

1. `WAITING_AGENT -> IN_PROGRESS -> WAITING_USER -> IN_PROGRESS`
2. 当前实现支持 `WAITING_AGENT|IN_PROGRESS|WAITING_USER -> RESOLVED`
3. `RESOLVED` 后用户或客服再次发消息时，会自动重开并回到活动态，历史不清空
4. 当前实现直接支持 `WAITING_AGENT|IN_PROGRESS|WAITING_USER|RESOLVED -> CLOSED`
5. `CLOSED` 后用户或客服再次发消息时，也会自动重开并回到活动态，历史不清空

## 9. 支付技术细节（固定 USDT 计价）

1. 全站价格统一用 `USDT` 计价，不做法币换算
2. 不做汇率来源、锁价窗口设计
3. 不增加客户端幂等参数，支付单按 `bookingId` 关联
4. 网络与币种固定为 `USDT + BSC/ERC20`，不做多链多币扩展
5. 每个支付单生成独立收款地址，便于对账

## 10. 与 `web3Wallet.ts` 对齐

`backend/src/helpers/web3/wallet/web3Wallet.ts` 已是 `ethers + ERC20_ABI`。  
MVP 配置建议：

1. `chainId = 56`
2. `tokenDecimals = 18`
3. `tokenAddress = BSC-USDT`
4. `rpc = BSC RPC`
5. `expiryHours = 0.5~1`

建议新增环境变量：

1. `PAYMENT_BSC_RPC_URL`
2. `PAYMENT_BSC_CHAIN_ID`
3. `PAYMENT_USDT_BSC_TOKEN_ADDRESS`
4. `PAYMENT_BATCH_CALL_ADDRESS`
5. `PAYMENT_MASTER_PRIVATE_KEY`
6. `PAYMENT_ORDER_EXPIRY_HOURS`

## 11. 管理端（MVP 最小能力）

至少提供以下后台能力用于数据录入：

1. 新增/编辑/下架服务
2. 维护管理员账号名单：bootstrap admin 走 env，只读展示；日常新增/停用管理员走 `/admin/access`
3. 维护 `support agent` 账号名单：统一走 `/admin/access`，并记录 `note/grantedBy/updatedBy`
4. 维护导游语言与排班
5. 维护车辆座位数与可用时段
6. 查看订单与支付异常（UNDERPAID、EXPIRED 等）
7. 激活/停用客服接待状态，并查看当前承接会话数
8. 手动改派、关闭客服会话，处理交接和升级

MVP 不做独立后台站点也可行：先用 GraphQL Admin Mutation + 内部工具页。

## 12. 错误处理与边界场景

1. 售罄：`remaining <= 0` 时禁止下单
2. 重复预订：同用户同服务同时间段判重
3. 价格变更：下单时写入 `serviceSnapshot`，后续不回溯
4. 支付超时：`expiredAt` 后拒绝记账
5. 支付金额不足：状态 `UNDERPAID`
6. 订单取消后仍到账：进入人工处理队列
7. 没有激活客服时：允许用户继续留言，会话状态置为 `WAITING_AGENT`
8. 客服被停用时：不再接收新会话，已有历史仍保留并允许管理员改派
9. 权限越权：普通用户访问他人客服会话时必须拒绝

## 13. 安全与合规

1. 地址生成策略：HD 派生 + 单订单单地址
2. 敏感字段（护照号/手机号）加密存储，日志脱敏
3. 支付与订单关键操作全链路审计日志
4. 个人数据支持导出/删除（GDPR 基本要求）
5. Crypto 业务上线前完成法务与合规评审
6. 客服消息默认纳入运营审计；删除/导出需保留操作痕迹
7. 客服共享视图仅对 `support agent/admin` 开放，普通用户按 `userId` 强制隔离

## 14. 实施顺序（建议）

1. 第 1 迭代：`catalog + booking + auth 衔接`
2. 第 2 迭代：`payment(usdt+bsc)`
3. 第 3 迭代：`assistant + order + notification + support(user side)`
4. 第 4 迭代：`admin 录入 + support 运营能力`

## 15. 外部参考链接

1. 人民银行（2021-09-24）答记者问：  
   https://www.pbc.gov.cn/rmyh/3963412/3963426/2025092319241092762/index.html
2. 人民银行（2021-06-21）约谈银行和支付机构：  
   https://www.pbc.gov.cn/goutongjiaoliu/113456/113469/2025092212551612812/index.html
3. 国务院英文站（2025-05-19）入境游数据：  
   https://english.www.gov.cn/archive/statistics/202505/19/content_WS682ae46ec6d0868f4e8f2aa6.html
4. Travala 支付方式：  
   https://www.travala.com/en-us/payment-options
5. Tether Supported Protocols：  
   https://tether.to/en/supported-protocols/
