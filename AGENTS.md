# AGENTS.md

## 1. 项目定位
- 项目名：`sean-tour`
- 项目类型：旅游网站（前后端分离）
- 目标：稳定迭代旅游业务能力（例如用户、内容、行程、订单等）

## 2. 仓库结构
- `frontend`：前端应用（Vue 3 + Vite）
- `backend`：后端服务（NestJS + TypeScript）
- `helpers`：通用工具与辅助脚本
- `tmp`：临时实验目录，不作为正式业务依赖

## 3. 开发命令
- 包管理器：`pnpm`（根目录已固定 `pnpm@10.12.1`）

前端（`frontend`）：
- 安装依赖：`pnpm --dir frontend install`
- 本地开发：`pnpm --dir frontend dev`
- 打包构建：`pnpm --dir frontend build`
- 预览构建产物：`pnpm --dir frontend preview`

后端（`backend`）：
- 安装依赖：`pnpm --dir backend install`
- 本地开发：`pnpm --dir backend start:dev`
- 代码检查：`pnpm --dir backend lint`
- 单元测试：`pnpm --dir backend test`
- 打包构建：`pnpm --dir backend build`

## 4. 通用协作规则
- 改动前先阅读相关目录和现有实现，避免重复造轮子。
- 保持最小改动原则：只修改完成目标所需文件。
- 不提交临时代码（调试日志、注释掉的大段旧代码、无用文件）。
- 接口或数据结构变更时，前后端在同一迭代内同步更新。
- 新增环境变量时，补充示例配置与使用说明。

## 5. 前端约定（`frontend`）
- 使用 Vue 3 Composition API（`<script setup>`）风格。
- 页面逻辑与可复用组件分离，避免超大组件。
- 业务接口调用统一收敛到 API/Service 层（建议放在 `src/api`）。
- 避免把开发占位文案和调试 UI 提交到主分支。
- 样式优先局部维护；全局样式仅放 reset 和设计 token。

## 6. 后端约定（`backend`）
- 按领域组织模块：`module + resolver/controller + service + dto`。
- Resolver/Controller 负责入参、鉴权和响应编排，业务逻辑放 Service。
- DTO 明确输入输出字段，避免隐式字段穿透。
- 外部依赖（如 Supabase、WeChat）统一封装在专用 Service，禁止散落调用。
- 涉及权限控制时遵循最小权限原则，默认拒绝未授权访问。
- 所有公共可复用的工具都在backend/helpers里面,都在这里修改和存放.
- backend/src/auth,backend/src/common 通用工具都在这里面.


## 7. 提交前检查清单
- 前端可构建：`pnpm --dir frontend build`
- 后端可构建：`pnpm --dir backend build`
- 后端 lint 通过：`pnpm --dir backend lint`
- 关键改动需附带测试或最小可复现的手工验证说明

## 8. 变更记录建议
重要规则变化建议追加记录（日期 + 背景 + 决策 + 影响），便于后续协作追溯。

## 9. Custom Rules（你后续追加）
你可以把后续规则直接按下面模板追加在这里。

### Rule Template
- Rule:
- Why:
- Example (optional):

### Rule 2026-03-03 Auth UI Consistency
- Rule: `frontend/src/pages/auth` 下的认证页面必须统一采用 Tripadvisor 风格视觉，并优先使用 PrimeVue 组件 + TailwindCSS 工具类，不再新增自定义原子表单样式。
- Why: 保持认证流程的一致体验与可维护性，降低页面分散演进导致的 UI 偏差。
- Example (optional): 认证页统一复用 `src/components/auth/AuthSplitLayout.vue`，表单控件优先使用 PrimeVue 的 `InputText`、`Password`、`Button`、`Message`。

### Rule 2026-03-03 Build Progress Tracking
- Rule: 仓库根目录必须维护 `BuildProgress.md` 作为唯一进度看板。每次任务结束后都要更新「当前阶段」「已完成」「下一步」「阻塞项」。
- Why: 方便快速查看当前迭代做到哪里，减少口头同步和上下文丢失。
- Example (optional): 完成支付模块骨架后，在 `BuildProgress.md` 标记为已完成，并写明下一步是接入链上回调。
