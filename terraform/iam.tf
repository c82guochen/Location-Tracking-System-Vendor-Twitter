# role => a task execution role
# 其实就是之前配置的各种各样的policies（主要针对ecs和ec2）
data "aws_iam_policy_document" "assume_role_policy" {
    statement {
      actions = ["sts:AssumeRole"]

      principals {
        type = "Service"
        identifiers = ["ecs-tasks.amazonaws.com"]
      }
    }
}

resource "aws_iam_role" "ecsTaskExecutionRole" {
    name = "${var.app_name}-ecs-task-execution-role"
    # 绑定对应的policy
    assume_role_policy = data.aws_iam_policy_document.assume_role_policy.json
}

# policy 1 EC2 policy
resource "aws_iam_role_policy_attachment" "ec2_policy" {
    role = aws_iam_role.ecsTaskExecutionRole.name
    # ec2的arn
    policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

# policy 2 dynamodb and sqs
data "aws_iam_policy_document" "twitter_service_access" {
    statement {
      effect = "Allow"
      actions = [
        "dynamodb:DescribeTable",
        "dynamodb:Scan",
        "dynamodb:UpdateItem",
        # 实际工作中不准用*这种全部权限的情况
        "sqs:*"
      ]
      resources = [
        "arn:aws:sqs:${var.aws_region}:${local.account_id}:${var.sqs_queue_name}",
        "arn:aws:dynamodb:${var.aws_region}:${local.account_id}:table/${var.dynamodb_vendor_table_name}"
      ]
    }
}

// 让上一部分policy生效
resource "aws_iam_policy" "twitter_service_access" {
    name = "${var.app_name}-twitter-service-access"
    policy = data.aws_iam_policy_document.twitter_service_access.json
    description = "Allows access for dynamodb & SQS for our Twitter service"
}

// 最后全部绑定到一起
resource "aws_iam_role_policy_attachment" "attach_twitter_service_access_policy" {
    policy_arn = aws_iam_policy.twitter_service_access.arn
    role = aws_iam_role.ecsTaskExecutionRole.name
}