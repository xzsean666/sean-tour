# Build Progress

## Meta
- Last Updated: 2026-03-03
- Owner: Sean + Codex
- Current Phase: MVP Skeleton Implementation

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
  - `catalog` 已支持服务列表筛选、分页和服务详情 Union。
  - `booking` 已支持创建预订、我的预订分页、预订详情、取消预订（含状态约束）。
  - `payment` 已支持按 `bookingId` 创建 USDT(BSC/ERC20) 支付意图（MVP 固定参数）。
  - 前端已新增 `ServicesPage / CheckoutPage / OrdersPage / OrderDetailPage` 及路由，页面数据统一收敛到 `src/api/travelService.ts`。
  - 前端构建验证通过：`pnpm --dir frontend build`。
  - 后端构建验证通过：`pnpm --dir backend build`（已修复 helpers 路径与缺失依赖）。
- 进行中：
  - 将 backend 模块骨架从内存数据切换到 `travel_kv` 持久化（`DBService`）。
  - 补齐前端与后端 GraphQL 的真实联调（当前为前端 mock service）。
  - 清理 backend ESLint 历史技术债（当前 `eslint` 仍有大量存量问题）。
- 下一步：
  - 完成 `catalog/booking/payment` 从内存到 `travel_kv` 的持久化切换。
  - 增加 payment 状态更新入口（链上回调/轮询接口骨架）并打通 orders 真实数据。
  - 前端接入真实 GraphQL API，替换本地 mock 数据源。

## Blockers
- 当前主要阻塞是 backend lint 存量问题（历史代码中大量 `no-unsafe-*` 与格式规则告警/错误），影响执行 `pnpm --dir backend lint` 作为准入门槛。

## Change Log
- 2026-03-03: 初始化进度看板；记录当前方案与下一步开发计划。
- 2026-03-03: 根据评审意见重构 `docs/crypto-travel-cn-design.md`，去除手动索引方案并补齐 auth/分页/管理端与支付细节。
- 2026-03-03: 支付方案进一步简化为“全局固定 USDT 计价”，移除汇率/锁价/幂等参数/链与合约校验文档设计。
- 2026-03-03: 优化 `PGKVDatabase.searchJson`（`contains` 改为 `jsonb @>`、支持 `offset/include_total`、修复 DESC 游标方向）并在初始化阶段为老表补建索引。
- 2026-03-03: 新增后端 `catalog/booking/payment` GraphQL 模块骨架，并完成前端 `services/checkout/orders` 页面骨架与路由接入。
- 2026-03-03: 修复 backend 构建基础阻塞（新增 `helpers/sdk.ts`、修正错误 import、补齐依赖 `typeorm/pg/sqlite3/ethers/otplib/qrcode`），恢复 `backend build` 通过。
