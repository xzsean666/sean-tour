# Build Progress

## Meta
- Last Updated: 2026-03-03
- Owner: Sean + Codex
- Current Phase: Planning

## Scope
- 主题：支持 Crypto（MVP: USDT on BSC/ERC20）的中国旅行服务平台
- 服务：旅游套餐、专业导游（多语种）、包车（多座位带司机）、远程中国小助手

## Milestones
| Milestone | Status | Notes |
| --- | --- | --- |
| 方案文档（前后端 + KV） | Done | `docs/crypto-travel-cn-design.md` 已创建并更新为 USDT+BSC/ERC20 |
| 后端 catalog 模块骨架 | Todo | - |
| 后端 booking 模块骨架 | Todo | - |
| 后端 payment(usdt+bsc) 模块骨架 | Todo | - |
| 前端 services / checkout / orders 页面骨架 | Todo | - |

## Current Progress
- 已完成：
  - 设计文档已落地，支付约束已统一为 USDT + BSC/ERC20。
  - 已根据评审建议完成文档二次重构（auth 衔接、分页、支付状态机、Union、管理端、边界场景与合规）。
- 进行中：
  - 无
- 下一步：
  - 开始搭建 `catalog + booking + payment` 的后端模块骨架。

## Blockers
- 后端当前构建存在依赖与路径问题（与本次文档变更无关），需要单独修复后再跑完整验证。

## Change Log
- 2026-03-03: 初始化进度看板；记录当前方案与下一步开发计划。
- 2026-03-03: 根据评审意见重构 `docs/crypto-travel-cn-design.md`，去除手动索引方案并补齐 auth/分页/管理端与支付细节。
- 2026-03-03: 支付方案进一步简化为“全局固定 USDT 计价”，移除汇率/锁价/幂等参数/链与合约校验文档设计。
