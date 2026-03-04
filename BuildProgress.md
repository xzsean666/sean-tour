# Build Progress

## Meta
- Last Updated: 2026-03-04
- Owner: Sean + Codex
- Current Phase: MVP API Integration

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
  - 后端已接入 `catalog + booking + payment` 三个 GraphQL 模块骨架，并在 `app.module.ts` 完成注册。
  - `catalog` 已切换到 `travel_kv` 持久化，支持服务列表筛选、分页和服务详情 Union。
  - `booking` 已切换到 `travel_kv` 持久化，支持创建预订、我的预订分页、预订详情、取消预订（含状态约束）。
  - `payment` 已切换到 `travel_kv` 持久化，支持按 `bookingId` 创建 USDT(BSC/ERC20) 支付意图（MVP 固定参数）。
  - 已新增 `paymentByBooking` 查询接口，checkout/orders 可读取当前支付单状态。
  - 已新增 `adminUpdatePaymentStatus` GraphQL mutation 与 REST 回调骨架（`POST /payment/callback/usdt`、`POST /payment/sync`，使用 `admin_auth_code` 头鉴权）。
  - `payment` 状态推进已支持 `paymentId/bookingId` 维度更新（`status/paidAmount/txHash/confirmations`），并在 `PAID` 时联动 `booking` 状态到 `PAID`。
  - 已新增 `catalog` 管理写接口 `adminUpsertService`（按 `service type` 校验 detail 结构，支持录入/更新服务）。
  - `booking.serviceSnapshot` 已补齐 `city` 字段，减少前端拼装。
  - 已新增 `order` 聚合模块（`myOrders/orderDetail`），统一聚合 booking + payment。
  - 前端已新增 `ServicesPage / CheckoutPage / OrdersPage / OrderDetailPage` 及路由，页面数据统一收敛到 `src/api/travelService.ts`。
  - 前端 `travelService` 已改为真实 GraphQL 调用（`serviceList/createBooking/bookingDetail/paymentByBooking/createUsdtPayment/myOrders/orderDetail`）。
  - 前端已支持 Supabase Session 自动换取 backend JWT（`loginWithSupabaseToken`）并本地存储供业务 API 调用。
  - 前端 services 页已改为“创建 booking 后跳转 checkout”，不再使用 fake bookingId。
  - 前端 orders 页已接入后端分页参数，支持 booking status 过滤 + 上一页/下一页分页。
  - 前端 checkout 页已增加支付状态轮询（15s）和支付成功自动跳转订单详情。
  - 前端构建验证通过：`pnpm --dir frontend build`。
  - 后端构建验证通过：`pnpm --dir backend build`。
- 进行中：
  - 清理 backend ESLint 历史技术债（当前 `eslint` 仍有大量存量问题）。
- 下一步：
  - 增加管理端 service 列表/详情编辑页面，接入 `adminUpsertService`（替换手工 GraphQL 调用）。
  - 增加支付回调签名校验/幂等事件日志（当前仅管理员头鉴权 + 直接状态写回）。
  - 补齐支付状态流测试（支付成功/过期/部分支付）并增加最小回归用例。

## Blockers
- 当前主要阻塞是 backend lint 存量问题（历史代码中大量 `no-unsafe-*` 与格式规则告警/错误），影响执行 `pnpm --dir backend lint` 作为准入门槛。

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
