# Build Progress

## Meta
- Last Updated: 2026-03-13
- Owner: Sean + Codex
- Current Phase: MVP Capability Completion

## Scope
- 主题：支持 Crypto（MVP: USDT on BSC/ERC20）的中国旅行服务平台
- 服务：旅游套餐、专业导游（多语种）、包车（多座位带司机）、远程中国小助手

## Milestones
| Milestone | Status | Notes |
| --- | --- | --- |
| 方案文档（前后端 + KV） | Done | `docs/crypto-travel-cn-design.md` 已创建并更新为 USDT+BSC/ERC20 |
| 后端 catalog 模块骨架 | Done | 已新增 `catalog` 模块（serviceList/serviceDetail + ServiceDetail Union） |
| 后端 booking 模块骨架 | Done | 已新增 `booking` 模块（create/cancel/myBookings/bookingDetail） |
| 后端 payment(usdt+bsc) 模块骨架 | Done | 已新增 `payment` 模块（createUsdtPayment，固定 USDT+BSC+ERC20） |
| 前端 services / checkout / orders 页面骨架 | Done | 已新增页面、路由与 `src/api/travelService.ts` 业务 API 层 |

## Current Progress
- 已完成：
  - 已完成 `docs/crypto-travel-cn-design.md` 与当前前后端实现的差距复核，确认剩余缺口主要集中在：服务详情/分类路由、用户资料与通知模块、容量/排班模型、订单全状态流转与管理端订单视图。
  - 后端已接入 `catalog + booking + payment` 三个 GraphQL 模块骨架，并在 `app.module.ts` 完成注册。
  - `catalog` 已切换到 `travel_kv` 持久化，支持服务列表筛选、分页和服务详情 Union。
  - `booking` 已切换到 `travel_kv` 持久化，支持创建预订、我的预订分页、预订详情、取消预订（含状态约束）。
  - `payment` 已切换到 `travel_kv` 持久化，支持按 `bookingId` 创建 USDT(BSC/ERC20) 支付意图（MVP 固定参数）。
  - 已新增 `paymentByBooking` 查询接口，checkout/orders 可读取当前支付单状态。
  - 已新增 `adminUpdatePaymentStatus` GraphQL mutation 与 REST 回调骨架（`POST /payment/callback/usdt`、`POST /payment/sync`，使用 `admin_auth_code` 头鉴权）。
  - `payment` 状态推进已支持 `paymentId/bookingId` 维度更新（`status/paidAmount/txHash/confirmations`），并在 `PAID` 时联动 `booking` 状态到 `PAID`。
  - `payment` 已增加回调签名与幂等能力：`eventId` 去重、`payment_event:*` 事件日志、callback HMAC-SHA256 签名校验（`PAYMENT_CALLBACK_SECRET`）。
  - `payment` 已新增 replay 冷却策略：`PAYMENT_REPLAY_COOLDOWN_SECONDS` 内对同源（ADMIN/SYNC）同状态重复推进自动跳过。
  - `payment` 已新增 `adminPaymentEvents` 查询（按 `eventId/paymentId/bookingId/source/status` + 分页检索 `payment_event`）。
  - 已新增 `payment.service` 单测，覆盖签名失败、缺少 callback secret、`eventId` 幂等 + booking 联动一次等关键路径。
  - `payment.service` 单测已补充 `adminPaymentEvents` 检索过滤与 replay 冷却拦截用例。
  - 已新增 `payment.entry` 集成测试，覆盖 GraphQL `adminUpdatePaymentStatus/adminPaymentEvents` 与 REST callback（签名 + 幂等）入口链路。
  - 已新增 `order-payment-flow.entry` 集成测试，覆盖 `createBooking -> createUsdtPayment -> callback -> orderDetail(paymentEvents)` 全链路。
  - 已新增 `catalog` 管理写接口 `adminUpsertService`（按 `service type` 校验 detail 结构，支持录入/更新服务）。
  - 已新增 `catalog` 管理动作：`adminSetServiceStatus`（上下架）/`adminDeleteService`（软删+硬删）/`adminServiceAuditLogs`（操作审计查询）。
  - 前端已新增 `/admin/services` 管理页（服务列表 + 详情编辑 + 按类型 detail 表单），并接入 `adminUpsertService`。
  - 前端 `/admin/services` 已接入上下架、软删/硬删和审计日志展示。
  - 前端 `/admin/services` 已支持图片数组可视化编辑：回填历史 `images`、实时解析预览和链接校验。
  - 前端已新增 `/admin/payments` 观测页：支持按事件维度检索 `payment_event`，并可手动触发 `adminUpdatePaymentStatus`。
  - 前端 `/admin/payments` 已补充分页与 CSV 导出，支持按过滤条件导出排障数据。
  - 前端 `/admin/payments` 已支持事件级一键 replay（带确认），可从事件直接重放状态推进。
  - 前后端已补充 replay 操作审计：`payment_event` 新增 `actor/replayOfEventId`，管理页展示并导出“谁在何时重放了哪个事件”。
  - 前端 `/admin/payments` 已支持按 `actor/replayOfEventId` 过滤事件，后端 `adminPaymentEvents` 同步支持该检索条件。
  - `adminUpsertService` 已增加更新兼容：未传 `images`/对应 `detail` 时可复用已有值，避免编辑时误清空。
  - 已新增 `catalog.service` 单测，覆盖 status 变更、软删/硬删和 audit log 查询链路。
  - `booking.serviceSnapshot` 已补齐 `city` 字段，减少前端拼装。
  - 已新增 `order` 聚合模块（`myOrders/orderDetail`），统一聚合 booking + payment。
  - `orderDetail` 已补充 `paymentEvents` 时间线字段（来源/source、状态、金额、确认数、txHash、事件时间）。
  - 前端已新增 `ServicesPage / CheckoutPage / OrdersPage / OrderDetailPage` 及路由，页面数据统一收敛到 `src/api/travelService.ts`。
  - 前端 `OrderDetailPage` 已展示支付事件时间线，便于回调排障和状态追踪。
  - 前端 `travelService` 已改为真实 GraphQL 调用（`serviceList/createBooking/bookingDetail/paymentByBooking/createUsdtPayment/myOrders/orderDetail`）。
  - 前端已支持 Supabase Session 自动换取 backend JWT（`loginWithSupabaseToken`）并本地存储供业务 API 调用。
  - 前端 `authService` 已增加统一输入校验（email 格式、空值、密码最小长度）并自动标准化（trim/lowercase），减少无效认证请求。
  - 前端路由已增加 `requiresAuth` 守卫（checkout/orders/admin 页面），未登录统一跳转登录并携带 `redirect` 回跳参数。
  - 登录页已支持按 `redirect` 参数回跳原目标页面，减少登录后手动重新导航。
  - 前端已新增 backend 未授权统一处理：token 失效时自动清理会话并跳转登录（携带 `reason=session-expired` + `redirect`），登录页统一提示“Session expired. Please sign in again.”。
  - 支付/订单入口回归已补齐失败分支：签名错误（callback）、无权限（admin/order detail）和过期单（orderDetail `paymentStatus=EXPIRED`）。
  - 前端 services 页已改为“创建 booking 后跳转 checkout”，不再使用 fake bookingId。
  - 前端 orders 页已接入后端分页参数，支持 booking status 过滤 + 上一页/下一页分页。
  - 前端 checkout 页已增加支付状态轮询（15s）和支付成功自动跳转订单详情。
  - 前端已完成路由级懒加载（lazy import），构建产物拆分为多 chunk，主包体积告警已消除。
  - 已新增发布前最小手工冒烟清单 `docs/mvp-smoke-checklist.md`，覆盖登录->下单->签名回调->订单详情闭环与负向校验。
  - 已新增 `backend/scripts/payment-callback-smoke.mjs` + `pnpm --dir backend smoke:payment-callback`，支持 callback/sync 两个入口的 smoke（callback 自动签名，含 dry-run）。
  - backend 定点 lint 已收口：`src/payment + src/order + src/catalog` 范围 `eslint` 通过。
  - backend 定点 lint 已收口：`src/auth` 范围 `eslint` 通过（`auth.guard/invite-code/otp` 等已完成类型收敛）。
  - backend 定点 lint 已收口：`src/common` 范围 `eslint` 通过（已完成 `worker.service` 类型安全收敛）。
  - backend 定点 lint 已收口：`src/main.ts` 与 `helpers/encodeUtils(jwt/crypto)` 范围 `eslint` 通过。
  - backend 定点 lint 已收口：`helpers/dbUtils/KVCache.ts` 通过（缓存装饰器类型安全与参数解析已收敛）。
  - backend web3 helper 收口：`ethersTxHelper / ethersTxBatchHelper / wallet/web3Wallet` 已完成 `any` 收敛与错误处理标准化，`eslint` 通过。
  - backend 全量 lint 已通过（`pnpm --dir backend lint`，0 error / 0 warning）。
  - 前端构建验证通过：`pnpm --dir frontend build`。
  - 后端构建验证通过：`pnpm --dir backend build`。
  - 支付链路关键测试通过：`payment.service.spec.ts`、`payment.entry.spec.ts`、`order-payment-flow.entry.spec.ts`。
  - 后端新增 `assistant` 模块：`requestAssistantSession/myAssistantSessions/assistantSessionDetail/adminAssistantSessions/adminUpdateAssistantSession`，支持远程小助手会话创建、查询和管理状态推进。
  - 后端 `assistant` 管理能力补齐：`adminAssistantSessions` 新增 `assignedAgent` 过滤，新增 `adminBatchAssignAssistantSessions` 批量分配 mutation（支持多会话批量指派、可选状态与备注更新）。
  - 前端新增 `/assistant` 页面与 `src/api/assistantService.ts`，已接入助手会话提单与历史会话列表；导航与订单详情已增加快捷入口。
  - 前端新增 `src/api/adminAssistantService.ts` 与 `/admin/assistant` 运营页，已接入 `adminAssistantSessions + adminUpdateAssistantSession + adminBatchAssignAssistantSessions`，支持筛选、批量分配、单条状态/备注维护。
  - 前端 UI 完成旅游平台风格升级：重做 `App` 导航壳层与 `Services/Checkout/Orders/OrderDetail/Assistant` 五个核心页面（品牌 Hero、卡片信息层级、状态可视化与移动端布局优化）。
  - `booking` 新增核心风控：仅 `ACTIVE` 服务可下单、CAR 服务按 `seats` 校验 `travelerCount`、同用户同服务时间段重复预订拦截（排除已取消单）。
  - 新增 `assistant.service.spec.ts`、`booking.service.spec.ts`，并更新 `order-payment-flow.entry.spec.ts` 以覆盖新风控后的稳定回归。
  - `payment` 已接入 `helpers/web3/wallet/web3Wallet.ts`：`createUsdtPayment` 通过 `PaymentWalletService` 创建链上收款订单并动态分配收款地址（配置缺失时自动回退占位地址，避免开发环境阻塞）。
  - 已新增支付链配置项：`PAYMENT_BSC_RPC_URL/PAYMENT_BSC_CHAIN_ID/PAYMENT_USDT_BSC_TOKEN_ADDRESS/PAYMENT_BATCH_CALL_ADDRESS/PAYMENT_MASTER_PRIVATE_KEY/PAYMENT_ORDER_EXPIRY_HOURS/PAYMENT_TOKEN_DECIMALS`。
  - 已新增 `payment-wallet.service.spec.ts`，覆盖“配置缺失回退”与“完整配置下调用 Web3Wallet.createPaymentOrder”两条关键路径。
  - 关键验证通过：`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend test -- payment/payment-wallet.service.spec.ts payment/payment.service.spec.ts payment/payment.entry.spec.ts order/order-payment-flow.entry.spec.ts`、`pnpm --dir frontend build`。
  - 已完成用户侧信息架构补齐：新增 `/packages`、`/guides`、`/cars` 列表/详情页，首页改为进入详情页后再选日期/人数/时段创建 booking；同时补齐 `/profile`、`/faq`、`/support` 与 `/assistant` 介绍页。
  - 已完成后端 `user` / `notification` 领域落地：新增用户资料查询/更新/导出/删除、通知列表/已读能力，并将敏感资料字段加密存储。
  - 已完成 `catalog + booking + order` 数据扩展：服务支持 `capacity/availableTimeSlots/supportContact/voucherTemplate/cancellationPolicy`，booking 支持时段与容量校验，order 聚合支持联系人、凭证、退款状态和更完整支付状态。
  - 已完成管理端补齐：新增 `/admin/orders`，支持按用户/booking/payment 状态筛选、查看订单详情、检查 payment timeline，并推动 booking 状态流转；`/admin/services` 同步支持编辑容量、时段、联系人、凭证模板等字段。
  - 前端订单与 checkout 已适配 `PARTIALLY_PAID/UNDERPAID/REFUNDING/REFUNDED`，订单详情已展示联系信息、凭证与取消政策。
  - 已补齐列表页筛选能力：`serviceList` 现支持城市、语言、日期、价格区间和分页；首页与分类页筛选栏已同步接入。
  - 已补齐资源级排班 MVP：服务支持 `resources` roster 录入与展示，booking 会按 `timeSlot` 自动分配导游/车辆/助手资源，取消后自动回补时段；订单页与 admin orders 已展示指派资源。
  - 本轮验证通过：`pnpm --dir frontend install`、`pnpm --dir frontend build`、`pnpm --dir backend install`、`pnpm --dir backend build`、`pnpm --dir backend lint`、`pnpm --dir backend exec jest --runInBand`。
  - 资源排班本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
  - 已补齐资源运营第一版：新增 `adminAssignableBookingResources` 查询与 `adminReassignBookingResource` mutation，`/admin/orders` 现可查看当前可改派资源并执行人工改派。
  - 资源改派本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
  - 已补齐资源排班面板：新增 `adminServiceResourceSchedule` 查询，`/admin/services` 现可查看资源占用、未指派 booking 与冲突槽位摘要。
  - 资源排班面板本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
  - 已补齐资源运营跨页闭环：`adminOrders` 新增 `serviceId/bookingId` 过滤，`/admin/services` 排班面板中的 booking 现可直接跳到 `/admin/orders` 对应筛选结果。
  - 跨页联动本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
  - 已补齐排班面板内直接改派：`/admin/services` 现可为资源卡片中的 booking 和未指派 booking 直接加载可改派资源并提交改派，无需先跳转 `/admin/orders`。
  - 面板内改派本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
  - 已补齐排班面板待处理队列：`/admin/services` 现统一展示冲突 booking 与未指派 booking，并可直接在队列中加载可改派资源、提交改派或跳转对应订单。
  - 待处理队列本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
  - 已增强资源运营视图：`/admin/services` 新增按 `timeSlot` 聚合的 `Dispatch Timeline`、按日期聚合的 `Date Load` 卡片，并支持点击日期卡片直接套用排班日期过滤。
  - 已补齐排班日期过滤：`adminServiceResourceSchedule` 新增可选 `date` 参数，前端排班面板支持按日筛选并在刷新/改派后保留当前日期视图；同时补充 `booking.service.spec.ts` 的日期过滤回归。
  - 资源运营视图增强本轮回归通过：`pnpm --dir frontend build`、`pnpm --dir backend lint`、`pnpm --dir backend build`、`pnpm --dir backend exec jest --runInBand`。
- 进行中：
  - 继续把当前 MVP 能力从“功能闭环完整”提升到“运营精细化”，重点是 admin 权限模型与更强的资源排班运营视图。
- 下一步：
  - 为 `user/profile`、`notification`、`admin orders`、`capacity/time slot` 增补后端单测与端到端回归。
  - 将当前排班面板继续演进为更完整的日历视图，并补齐 URL 可分享的筛选状态。
  - 配置并联调真实 USDT 收款环境参数（RPC/Token/BatchCall/MasterKey），完成链上订单创建与对账验证。
  - 收口 admin 权限模型，避免当前仅依赖 `admin_auth_code` 的粗粒度运营入口。

## Blockers
- 暂无硬阻塞。

## Change Log
- 2026-03-03: 初始化进度看板；记录当前方案与下一步开发计划。
- 2026-03-03: 根据评审意见重构 `docs/crypto-travel-cn-design.md`，去除手动索引方案并补齐 auth/分页/管理端与支付细节。
- 2026-03-03: 支付方案进一步简化为“全局固定 USDT 计价”，移除汇率/锁价/幂等参数/链与合约校验文档设计。
- 2026-03-03: 优化 `PGKVDatabase.searchJson`（`contains` 改为 `jsonb @>`、支持 `offset/include_total`、修复 DESC 游标方向）并在初始化阶段为老表补建索引。
- 2026-03-03: 新增后端 `catalog/booking/payment` GraphQL 模块骨架，并完成前端 `services/checkout/orders` 页面骨架与路由接入。
- 2026-03-03: 修复 backend 构建基础阻塞（新增 `helpers/sdk.ts`、修正错误 import、补齐依赖 `typeorm/pg/sqlite3/ethers/otplib/qrcode`），恢复 `backend build` 通过。
- 2026-03-04: `catalog/booking/payment` 切换到 `travel_kv` 持久化存储（key 前缀 + `entityType`）并完成 backend build。
- 2026-03-04: 前端新增 backend GraphQL 客户端与 token 交换链路（Supabase access token -> backend JWT），`travelService` 切到真实 API。
- 2026-03-04: 新增 `paymentByBooking` 查询、`order` 聚合模块（`myOrders/orderDetail`），并把前端 orders/checkout 切到聚合 API。
- 2026-03-04: 新增 `payment` 状态推进接口骨架（`adminUpdatePaymentStatus` + `/payment/callback/usdt` + `/payment/sync`），并在支付完成时联动更新 `booking` 状态到 `PAID`。
- 2026-03-04: 前端 orders 页新增 booking status 过滤与分页 UI，`travelService.getMyOrders` 接入后端 `limit/offset` 参数。
- 2026-03-04: 前端 checkout 页新增支付状态轮询与支付成功自动跳转订单详情。
- 2026-03-04: 新增 `catalog.adminUpsertService` 管理写接口（录入/更新服务 + type/detail 结构校验）。
- 2026-03-04: 新增前端 `/admin/services` 管理页面，接入 `adminUpsertService`，并补充更新时保留已有 images/detail 的后端兼容逻辑。
- 2026-03-04: 支付回调新增 HMAC-SHA256 签名校验与 `eventId` 幂等事件日志（`payment_event:*`），并在 `backend/.env.example` 增加 `PAYMENT_CALLBACK_SECRET`。
- 2026-03-04: 新增 `backend/src/payment/payment.service.spec.ts`，覆盖支付回调签名与幂等关键回归用例。
- 2026-03-04: `catalog` 新增管理动作 `adminSetServiceStatus/adminDeleteService/adminServiceAuditLogs`，并在前端 `/admin/services` 接入上下架、删除和审计日志 UI。
- 2026-03-04: 新增 `backend/src/catalog/catalog.service.spec.ts`，覆盖服务状态变更、软删/硬删和审计日志查询回归用例。
- 2026-03-04: `orderDetail` 新增 `paymentEvents` 字段，后端聚合 `payment_event:*` 并在前端订单详情页渲染事件时间线。
- 2026-03-04: 管理端服务编辑页支持全量 `images` 回填与可视化预览，避免仅 `coverImage` 造成误改。
- 2026-03-04: 新增 `adminPaymentEvents` 管理查询与对应单测过滤场景，支持按事件维度排障检索。
- 2026-03-04: 新增前端 `/admin/payments` 管理页，接入 `adminPaymentEvents` 检索与 `adminUpdatePaymentStatus` 手动状态推进。
- 2026-03-04: 支付状态推进新增 replay 冷却防重复策略（`PAYMENT_REPLAY_COOLDOWN_SECONDS`），并补充单测覆盖同源重复事件跳过逻辑。
- 2026-03-04: 新增 `backend/src/payment/payment.entry.spec.ts`，打通 GraphQL + REST 入口的支付状态流集成测试（含 callback 签名与 eventId 幂等）。
- 2026-03-04: 前端 `/admin/payments` 增加分页和 CSV 导出能力，支持按过滤条件批量导出支付事件。
- 2026-03-04: 前端 `/admin/payments` 增加事件级 replay 按钮与二次确认流程，支持一键重放历史事件参数。
- 2026-03-04: 前端路由改为 lazy import，构建 chunk 明显拆分，移除 >500k 主包告警。
- 2026-03-04: 新增 `backend/src/order/order-payment-flow.entry.spec.ts`，覆盖订单与支付回调联动链路的入口级集成测试。
- 2026-03-04: 前端 `authService` 增加 MVP 级输入校验与标准化，统一认证入口参数质量。
- 2026-03-04: 前端路由新增 `requiresAuth` 守卫 + 登录后 `redirect` 回跳，优化未登录访问受限页的 MVP 体验。
- 2026-03-04: 前端新增 token 失效统一收口（GraphQL 401/鉴权错误自动清会话并跳转登录），登录页增加 `session-expired` 提示文案。
- 2026-03-04: 支付 replay 审计补齐 `actor/replayOfEventId`（含管理页展示与 CSV 导出），并补充 `payment.service` 审计字段回归断言。
- 2026-03-04: 新增支付/订单失败分支入口回归：GraphQL 管理无权限、callback 签名错误、跨用户订单访问拒绝、过期单状态链路。
- 2026-03-04: `adminPaymentEvents` 新增 `actor/replayOfEventId` 过滤能力，并在管理端 Payment 观测页接入筛选 UI。
- 2026-03-04: 新增 `docs/mvp-smoke-checklist.md`，沉淀 MVP 发布前手工冒烟步骤与签名回调命令模板。
- 2026-03-04: backend lint 定点收口：`src/payment src/order src/catalog` 目录执行 `eslint` 已通过。
- 2026-03-04: backend lint 定点收口：`src/auth` 目录执行 `eslint` 已通过，并修复 auth/common 第一批类型安全与格式问题。
- 2026-03-04: backend `src/common` 第一批 lint 收口完成（`cache/alert/common-log/graphql-throttler`），`auth+common` 范围剩余主要集中在 `worker.service`。
- 2026-03-04: backend lint 定点收口：`src/common`（含 `worker.service`）通过；补充 `src/main.ts` 与 `helpers/encodeUtils(jwt/crypto)` 通过。
- 2026-03-04: backend lint 定点收口：`helpers/dbUtils/KVCache.ts` 通过，缓存装饰器链路已替换为显式类型安全实现。
- 2026-03-04: backend web3 辅助模块收口：`ethersTxHelper / ethersTxBatchHelper / wallet/web3Wallet` 完成类型安全修复并通过 `eslint`。
- 2026-03-04: backend 全量 `lint` 通过（0 error，保留少量历史 warning），`backend build` 再次验证通过。
- 2026-03-04: 支付链路关键测试回归通过（`payment.service/payment.entry/order-payment-flow.entry`）。
- 2026-03-04: 清理 legacy helper 最后一批 warning，`backend lint` 达到 0 error / 0 warning，并完成 build + 支付链路回归测试。
- 2026-03-04: 新增 payment callback smoke 脚本（自动 HMAC 签名 + 调用 `/payment/callback/usdt`），并更新 `docs/mvp-smoke-checklist.md` 使用说明。
- 2026-03-04: payment smoke 脚本扩展支持 `/payment/sync`（无签名模式）并补充文档示例，回归 `backend lint/build/test` 通过。
- 2026-03-04: 新增后端 `assistant` 模块（会话创建/查询/管理更新）并注册到 `app.module.ts`，补齐“远程中国小助手”业务闭环基础能力。
- 2026-03-04: 前端新增 `/assistant` 会话页与 API，订单详情新增“一键发起助手请求”入口。
- 2026-03-04: `booking` 增加风控规则（服务状态校验、包车座位上限、重复时段预订拦截），并新增 `booking.service.spec.ts` 回归覆盖。
- 2026-03-04: 新增 `PaymentWalletService` 并接入 `web3Wallet.ts`，`createUsdtPayment` 改为链上订单驱动的动态收款地址分配；同时补充配置项与 `payment-wallet.service.spec.ts` 回归。
- 2026-03-04: 后端 `assistant` 新增运营能力：`adminBatchAssignAssistantSessions` 批量分配 mutation + `adminAssistantSessions.assignedAgent` 过滤，并补充 `assistant.service.spec.ts` 对应回归用例。
- 2026-03-04: 前端新增助手运营 API/页面：`src/api/adminAssistantService.ts` + `/admin/assistant`，打通助手会话筛选、批量分配、单条更新闭环。
- 2026-03-04: 前端完成核心业务页 UI 升级（`App` 导航壳层 + `Services/Checkout/Orders/OrderDetail/Assistant`），统一为旅游平台视觉与信息结构。
- 2026-03-13: 完成 `docs/crypto-travel-cn-design.md` 对照评审，确认当前未完成项集中在服务详情路由、用户资料/通知、容量与排班、订单全状态流转及管理端订单视图。
- 2026-03-13: 补齐设计文档缺口第一轮实现：新增 `/packages|/guides|/cars|profile|faq|support|admin/orders` 页面与路由，落地 `user/notification` 模块、订单联系信息/凭证、容量与时段字段、扩展支付/退款状态，并通过 `frontend build`、`backend build`、`backend lint`、`backend jest --runInBand` 验证。
- 2026-03-13: 继续补齐列表页能力：`serviceList` 新增日期与价格区间筛选，首页与分类页 UI 同步接入，并补充 `catalog.service.spec.ts` 回归后再次通过 `frontend build`、`backend build`、`backend lint`、`backend jest --runInBand`。
- 2026-03-13: 新增资源级排班 MVP：`catalog.resources` roster、booking 自动资源指派与取消回补、订单/admin 视图中的指派资源展示，并补充 `catalog.service.spec.ts` 与 `booking.service.spec.ts` 回归。
- 2026-03-13: 新增资源运营第一版：admin 现在可按 booking 查询可改派资源并执行人工改派；同步扩展 order 聚合字段并通过 `frontend build`、`backend lint`、`backend build`、`backend jest --runInBand` 验证。
- 2026-03-13: 新增资源排班面板：`adminServiceResourceSchedule` 聚合服务级资源占用与未指派 booking，前端 `/admin/services` 已展示资源负载和冲突摘要，并通过 `frontend build`、`backend lint`、`backend build`、`backend jest --runInBand` 验证。
- 2026-03-13: 新增资源运营跨页闭环：`adminOrders` 支持 `serviceId/bookingId` 过滤，`/admin/services` 排班面板中的 booking 可直接跳转到订单运营页，并通过 `frontend build`、`backend lint`、`backend build`、`backend jest --runInBand` 验证。
- 2026-03-13: 新增排班面板内直接改派：`/admin/services` 可直接加载 booking 的可改派资源并提交改派，减少在 `/admin/services` 与 `/admin/orders` 之间来回切换，并通过 `frontend build`、`backend lint`、`backend build`、`backend jest --runInBand` 验证。
- 2026-03-13: 新增排班面板待处理队列：`/admin/services` 统一展示冲突 booking 与未指派 booking，并直接复用改派动作；同时补充 `booking.service.spec.ts` 冲突时段回归，验证 `frontend build`、`backend lint`、`backend build`、`backend jest --runInBand` 通过。
 - 2026-03-13: 增强资源运营视图：新增 `Dispatch Timeline`、`Date Load` 日期负载卡片和 `adminServiceResourceSchedule(date)` 日期过滤，前端排班面板支持按日查看并保留当前筛选回刷；同时补充 `booking.service.spec.ts` 日期过滤回归并通过 `frontend build`、`backend lint`、`backend build`、`backend jest --runInBand`。
