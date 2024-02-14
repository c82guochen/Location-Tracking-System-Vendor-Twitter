// # service对应的application都是以cluster的形式存在的，而cluster中存在一个或多个services
# 比如定义ecs.tf的时候上来就定义的是cluster
resource "aws_security_group" "lb_sg" {
  vpc_id = var.aws_vpc_id
  name = "${var.app_name}-lb-sg"

# loadBalancer是有health check的功能，所以暴漏端口为8080，所以接收到的所有请求也走端口8080
  ingress {
    from_port = 8080
    to_port = 8080
    # 支持点对点形式（因为不需要群发消息的UDP
    protocol = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }

  egress {
    from_port = 0
    to_port = 0
    protocol = "-1" 
    cidr_blocks = ["0.0.0.0/0"]
    ipv6_cidr_blocks = ["::/0"]
  }
}

# 决定该load balancer将挂载到哪个application上
# application balancer（alb）
resource "aws_alb" "alb" {
  name = "${var.app_name}-alb"
  internal = false
  load_balancer_type = "application"
  # 因为load balancer是在load public traffic
  subnets = var.aws_public_subnet_ids
  security_groups = [aws_security_group.lb_sg.id]
}

# 定期check所负责管理的cluster里的机器是否健康
resource "aws_lb_target_group" "target_group" {
  # 定义healthCheck请求的内容
  name = "${var.app_name}-tg"
  port = 8080
  protocol = "HTTP"
  target_type = "ip"
  vpc_id = var.aws_vpc_id

  health_check {
    # 最多做两次health check
    healthy_threshold = "2"
    interval = "200"
    protocol = "HTTP"
    matcher = "200"
    timeout = "3"
    path = "/"
    # 失败了也最多做两次
    unhealthy_threshold = "2"
    port = "8080"
  }
}

# loadBalancer不仅要负责healthCheck的消息发送，同时也要接response（比如编号为200的成功回复）
resource "aws_lb_listener" "listener" {
    load_balancer_arn = aws_alb.alb.id
    port = "8080"
    protocol = "HTTP"

    default_action {
      type = "forward"
      target_group_arn = aws_lb_target_group.target_group.id
    }
}