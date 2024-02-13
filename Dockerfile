# Base Image(Operating sys we need on Docker)
FROM node:20.3.1 

# 设置容器内的工作目录为/usr/src/app。
WORKDIR /usr/src/app

# Copy package.json into our main folder# Copy package.json into our main folder
# (. means root path 根路径，即WORKDIR)
COPY package.json .

# 用npm不用yarn的原因：operating sysytem是node，npm是node default command
# 运行npm install来安装package.json中指定的依赖，以及全局安装TypeScript。
RUN npm install && npm install typescript -g

# Copy all files in current path into docker root path
COPY . .

# 编译TypeScript代码生成build
RUN tsc

# 设置容器启动时执行npm start。
CMD [ "npm", "start" ]

EXPOSE 8080

# --interval=10s：每隔10秒执行一次健康检查。
# --timeout=：应该后面跟随一个时间值，表示等待健康检查响应的最长时间。这里表示没有timeout
# curl尝试访问容器的8080端口。如果请求失败（curl返回非零值），则执行exit 1，标示健康检查失败。
HEALTHCHECK --interval=10s --timeout= \ CMD curl -f http://localhost:8080/ || exit 1


# 小tips：
# Dockerfile 中的指令可以分为两类：构建镜像时执行的指令和容器启动时执行的指令。
    # 构建镜像时执行的指令：
    # 在 Dockerfile 中，大部分指令都是在构建镜像的过程中执行的，这包括：
        # FROM: 指定基础镜像。
        # WORKDIR: 设置工作目录。
        # COPY: 复制文件和目录到镜像。
        # RUN: 在镜像构建过程中执行命令。例如，安装依赖、编译TypeScript代码等。
    # 这些指令定义了镜像的内容和结构，即它们执行的结果都会被包含在最终的镜像中。比如，RUN npm install 安装的依赖和 RUN tsc 编译生成的 JavaScript 文件都会成为镜像的一部分。

    # 容器启动时执行的指令
    # 另一方面，CMD 指令指定了容器启动时默认执行的命令。这个命令在构建镜像的过程中并不会被执行，而是在基于该镜像启动新容器时执行。CMD 提供的命令可以在启动容器时被覆盖。
    # CMD [ "npm", "start" ]: 这条指令指定了容器启动时默认运行的命令。如果你没有在 docker run 命令中指定其他命令，那么容器将执行 npm start。

# 特殊指令：ENTRYPOINT vs CMD
    # 除了 CMD，还有一个 ENTRYPOINT 指令，它也指定了容器启动时执行的命令。
    # ENTRYPOINT 和 CMD 的不同之处在于，ENTRYPOINT 指定的命令不会被 docker run 命令行中的参数覆盖（尽管可以通过 Docker 命令行的 --entrypoint 选项来覆盖），而 CMD 指定的命令则可以。
    # 如果同时指定了 ENTRYPOINT 和 CMD，则 CMD 中的内容将作为参数传递给 ENTRYPOINT 指定的命令。

# 所以，直到 RUN tsc 的所有指令都是在构建镜像时执行的，用于设置镜像的状态。而 CMD [ "npm", "start" ] 则指定了容器实际启动后要执行的命令，属于运行时行为的定义。