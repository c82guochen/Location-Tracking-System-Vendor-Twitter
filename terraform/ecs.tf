// default 配置文件
// 定义整个class集群在ecs中的名字（即部署docker文件后给ecs cluster的标识）
resource "aws_ecs_cluster" "cluster" {
    name = "${var.app_name}-ecs-cluster"
}

// 运行期间的logs(logs of running docker files)
resource "aws_cloudwatch_log_group" "ecs_logs" {
  name = "${var.app_name}-ecs-logs"
}

// 后面的部分管理traffic
resource "aws_security_group" "ecs_sg" {
  // 该ecs向外暴露的地址（即VPC的id，因为只有vpc做了network setup）
  # 这一步是为了连接vpc和ecs group，让ecs group可以调用vpc网络地址
  vpc_id = var.aws_vpc_id
  name = "${var.app_name}-ecs-sg"

  // 输入
  ingress {
    from_port = 0
    to_port = 0
    protocol = "-1" // 接收所有协议
    security_groups = [aws_security_group.lb_sg.id]
  }
  # 这个入站规则允许从指定安全组（aws_security_group.lb_sg.id，可能是负载均衡器的安全组）中的所有端口和所有协议的流量进入。
  # 这意味着，只有从这个指定安全组的资源（如负载均衡器）发起的连接才被允许访问使用这个安全组的ECS服务。

  // 输出
  egress {
    from_port = 0
    to_port = 0
    protocol = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
  # 出站规则允许从使用该安全组的资源到任何目的地（IPv4使用0.0.0.0/0，IPv6使用::/0）的所有端口和协议的流量。
  # 这实现了允许容器（或资源）向外部发起连接的需求。
}
# 通过这种配置方式，你的ECS服务（或任何使用这个安全组的AWS资源）被配置为仅接受来自特定源（如负载均衡器）的入站连接，同时可以自由地向任何外部目的地发起出站连接。
# 这有助于保护你的ECS服务不受未经授权的外部访问，同时不限制其访问外部服务和资源的能力

// bucket和其中的文件
data "aws_s3_bucket_object" "secrets" {
    bucket = var.ecs_twitter_env_secrets_folder
    key = var.ecs_twitter_env_secrets_key
}

// 定义了ecs中docker file该如何执行（执行所需的配置信息
# 任务定义 (aws_ecs_task_definition): 定义了一个ECS任务，包括容器的定义（如镜像、环境变量、日志配置等）。
# 这是运行在ECS上的基础配置，指定了容器运行时的各项参数。
resource "aws_ecs_task_definition" "td" {
  // 这些都是固定的，aws上有模板
  family = "${var.app_name}-td" // family: 定义任务族的名称。

  // container_definitions: 容器定义的JSON字符串，详细描述了容器的配置，如使用的镜像、环境变量、端口映射等
  container_definitions = <<DEFINITION
  [
    {
      "name": "${var.app_name}-td",
      "image": "${local.account_id}.dkr.ecr.us-east-1.amazonaws.com/twitter:${var.image_tag}",
      "entryPoint": [],
      "environment": ${data.aws_s3_bucket_object.secrets.body},
      "essential": true,
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "${aws_cloudwatch_log_group.ecs_logs.id}",
          "awslogs-region": "${var.aws_region}",
          "awslogs-stream-prefix": "${var.app_name}"
        }
      },
      "portMappings": [
        {
          "containerPort": 8080,
          "hostPort": 8080
        }
      ],
      "cpu": 256,
      "memory": 1024,
      "networkMode": "awsvpc"
    }
  ]
  DEFINITION
 // requires_compatibilities: 指定兼容性类型，这里使用的是FARGATE，
 // 意味着任务将在AWS Fargate上运行，这是一个无需管理服务器的容器运行平台。
  requires_compatibilities = ["FARGATE"]
  // network_mode: 网络模式，设置为awsvpc，提供了在VPC内运行任务的能力，允许任务直接管理网络接口。
  network_mode             = "awsvpc"
  memory                   = "1024"
  cpu                      = "256"
  // 来自之前加的ecs related policy
  execution_role_arn       = aws_iam_role.ecsTaskExecutionRole.arn
  task_role_arn            = aws_iam_role.ecsTaskExecutionRole.arn
#  execution_role_arn 和 task_role_arn: 指定任务执行角色和任务角色的ARN，
#  这些角色提供了任务访问AWS资源所需的权限。
}

# 和上面的resource绑定到一起
data "aws_ecs_task_definition" "td" {
    task_definition = aws_ecs_task_definition.td.family
}

# 服务 (aws_ecs_service): 定义了一个ECS服务，用于管理运行指定任务定义的容器实例。
resource "aws_ecs_service" "ecs" {
  name = "${var.app_name}-ecs-service"
  # 服务所属的ECS集群的ID。
  cluster = aws_ecs_cluster.cluster.id
  task_definition = data.aws_ecs_task_definition.td.family
  // 如何收发:意味着服务将在Fargate上运行。
  launch_type = "FARGATE"
  // 当ecs服务不可用，如何寻找下一个ecs服务
  // REPLICA意为完全复制过去
  scheduling_strategy = "REPLICA"
  desired_count = 1
  force_new_deployment = true

  network_configuration {
    subnets = var.aws_private_subnet_ids
    assign_public_ip = false
    security_groups = [
        aws_security_group.ecs_sg.id,
        aws_security_group.lb_sg.id
    ]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.target_group.arn
    container_name = "${var.app_name}-td"
    container_port = 8080
  }

  depends_on = [
    aws_lb_listener.listener
  ]
}

// autoscaling是指当服务到了limitation时，该怎么expand
resource "aws_appautoscaling_target" "autoscaling" {
  # 定义了服务可以伸缩到的最大和最小任务副本数量。
  max_capacity = 1
  min_capacity = 1
  resource_id = "service/${aws_ecs_cluster.cluster.name}/${aws_ecs_service.ecs.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace = "ecs"
}

# 这个配置文件涵盖了在AWS上部署和管理容器化应用所需的基本组件，包括任务的定义、服务的创建和管理，以及基于负载变化自动调整任务副本数量的能力。
# 通过Terraform，可以以声明式的方式管理这些资源，使得基础设施的部署和变更更加一致和自动化。