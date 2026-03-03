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
9. `/checkout/:bookingId` 结算页（USDT/BSC/ERC20）
10. `/orders` 我的订单
11. `/orders/:id` 订单详情
12. `/profile` 用户资料页
13. `/faq` 常见问题
14. `/support` 客服支持

### 4.2 页面重点

1. 首页：统一入口 + 四类服务卡片 + 多语引导
2. 列表页：城市/语言/日期/价格筛选 + 分页
3. 详情页：服务范围、取消规则、可约时间、下单按钮
4. 结算页：USDT 固定计价金额、BSC 网络、支付倒计时、轮询状态
5. 订单页：预订状态 + 支付状态 + 联系信息 + 服务凭证

### 4.3 组件拆分建议

1. `ServiceCard`
2. `FilterBar`
3. `CryptoPayPanel`
4. `BookingSummary`
5. `OrderStatusTimeline`
6. `PagePagination`

## 5. 后端模块设计（NestJS）

按领域组织：`module + resolver + service + dto`。

1. `catalog`：服务查询与详情
2. `booking`：预订创建、状态流转
3. `payment`：USDT(BSC/ERC20) 支付单创建与状态更新
4. `assistant`：远程助手排班与会话
5. `order`：订单聚合查询
6. `user`：用户资料（护照/联系方式等）
7. `notification`：通知发送（站内/邮件）
8. `admin`：后台录入与运营接口

### 5.1 Auth 衔接（复用现有实现）

直接复用已有 `backend/src/auth` 体系（`AuthGuard`、`CurrentUser`、`AuthModule`）：

1. GraphQL 请求使用 `Authorization: Bearer <token>`
2. 需要登录的 Resolver 统一加 `@UseGuards(AuthGuard)`
3. 在 Resolver 通过 `@CurrentUser()` 取用户信息
4. `booking.userId` 统一来自 token 解出的 `user_id`，不允许前端传入
5. 管理端接口可复用 `CheckAdmin` 装饰器做最小权限控制

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
  requestAssistant(input: RequestAssistantInput!): AssistantSession!

  adminUpsertService(input: AdminUpsertServiceInput!): ServiceItem!
  adminSetServiceStatus(id: ID!, status: String!): Boolean!
}
```

`CreateUsdtPaymentInput` 建议字段：

1. `bookingId: ID!`

MVP 约束：

1. 不接受客户端传入 `token/network`
2. 后端写死：`token=USDT`、`network=BSC`、`tokenStandard=ERC20`

## 7. KV 数据模型（单表 + 无手动索引）

建议只开一个业务表：`travel_kv`。  
通过 key 前缀区分实体类型，value 全 JSON。

### 7.1 Key 规范（MVP）

1. `service:{serviceId}`
2. `booking:{bookingId}`
3. `payment:{paymentId}`
4. `assistant_session:{sessionId}`

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
2. 维护导游语言与排班
3. 维护车辆座位数与可用时段
4. 查看订单与支付异常（UNDERPAID、EXPIRED 等）

MVP 不做独立后台站点也可行：先用 GraphQL Admin Mutation + 内部工具页。

## 12. 错误处理与边界场景

1. 售罄：`remaining <= 0` 时禁止下单
2. 重复预订：同用户同服务同时间段判重
3. 价格变更：下单时写入 `serviceSnapshot`，后续不回溯
4. 支付超时：`expiredAt` 后拒绝记账
5. 支付金额不足：状态 `UNDERPAID`
6. 订单取消后仍到账：进入人工处理队列

## 13. 安全与合规

1. 地址生成策略：HD 派生 + 单订单单地址
2. 敏感字段（护照号/手机号）加密存储，日志脱敏
3. 支付与订单关键操作全链路审计日志
4. 个人数据支持导出/删除（GDPR 基本要求）
5. Crypto 业务上线前完成法务与合规评审

## 14. 实施顺序（建议）

1. 第 1 迭代：`catalog + booking + auth 衔接`
2. 第 2 迭代：`payment(usdt+bsc)`
3. 第 3 迭代：`assistant + order + notification`
4. 第 4 迭代：`admin 录入 + 运营能力`

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
