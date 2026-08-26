# 保留认证的中文测试镜像

本目录只服务于隔离测试，**不用于替换生产环境**。没有生产部署命令、服务器密钥、生产数据库连接或定时任务副本。

## 构建选择

- 使用公开源码与 `oss_core,all_languages,jemalloc,dind`，不使用包含 `no_auth` 的 `oss` 集合，也不使用依赖非公开源码的 `ce` 集合。
- 构建时检查 Cargo 解析后的依赖功能图，拒绝 Windmill 包中的 `no_auth`、`private` 和 `enterprise`。
- `zh-authenticated` 镜像入口拒绝 `NO_AUTH` 开关和 `--no-auth` 参数。控制 Docker 的管理员仍可覆盖入口，这不是对宿主机管理员的安全边界。
- 仅在隔离认证测试通过后发布 `auth-candidate-<完整提交 SHA>` 标签；不创建版本标签，不更新 `latest`，不发布正式版本。
- 原 Dockerfile 的默认目标仍为原始 runtime，不改变上游默认构建行为。

## 本地检查

```bash
node --test deploy/candidate/*.test.mjs
sh deploy/candidate/test-entrypoint.sh
bash deploy/candidate/test-smoke-cleanup.sh
bash -n deploy/candidate/run-smoke.sh
```

完整镜像构建和运行需要 Linux/amd64 Docker。GitHub Actions 中的 `Chinese authenticated candidate` 使用托管 Linux runner；分支必须为 `v1.775.1-zh-cn`。

认证测试创建独立 Compose 项目，PostgreSQL 数据只存于临时内存文件系统，网络禁止外部访问，HTTP 只绑定 `127.0.0.1:18090`。测试结束清理该项目。测试使用新数据库初始化的默认账号，不读取或连接生产账号；不要将此测试实例暴露到公网。

测试失败时，在清理前输出容器状态、脱敏后的最近启动日志和容器内部版本探针结果，用于区分进程退出、数据库初始化与端口访问问题；保留测试原有失败状态，不跳过认证门禁。构建使用 [Docker 官方 GitHub Actions 缓存方式](https://docs.docker.com/build/ci/github-actions/cache/)，缓存导出在构建步骤结束时执行，不依赖后续测试通过。缓存不等于已验证的候选发布，也不保证所有 Rust 编译缓存均能复用。

## 首轮构建记录

提交 `bc844a3b23d156bded0284742cf3acb0d4d23b9c` 的 [首次构建](https://github.com/nolyOne1/aiwise-windmill-zh/actions/runs/32923807121) 已完成完整镜像编译（约 67 分钟），功能图安全检查通过。隔离实例在 180 秒内未通过版本探针，认证检查未执行，镜像发布已跳过；该次未保存容器日志，不能据此断定是程序启动失败还是访问路径故障。没有可部署的已验证 digest。

## 发布前仍需验收

- [ ] 完整镜像成功编译，记录候选 digest。
- [ ] 匿名请求、无效令牌、错误密码均被拒绝，正确密码得到真实会话。
- [ ] 简体中文/English 切换和刷新保持；深层页面英文缺口逐一处理。
- [ ] 在隔离环境验证 Python 库存脚本的脱敏样例、worker、手动运行、定时运行、失败处理和日志。
- [ ] 对照当前官方 CE 检查功能差异；本镜像不承诺与 CE 功能一致。
- [ ] 确认数据库兼容性与回滚流程，取得单独的生产部署批准。

词典键数和类型检查通过不等于全量中文完成。已有词典含 888 个键，但如 `OperatorMenu.svelte` 的 `More triggers`、`FlowBuilder.svelte` 的 `Exit & see details` 仍需处理。本次不增加中文覆盖完成声明。

构建依赖沿用上游 Dockerfile；下载、系统依赖、编译资源或运行测试失败都必须阻止候选发布。未成功构建和运行前，不能称为可用镜像。
