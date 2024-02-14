resource "aws_sqs_queue" "sqs_queue" {
    name = var.sqs_queue_name
    # connect之后message broker只有60秒时间接收，过期则timeout失败并close connection
    visibility_timeout_seconds = 60
    max_message_size = 2048 # 2M
    message_retention_seconds = 86400 # 存放时间：24h
    receive_wait_time_seconds = 3
    # 设置长轮询的等待时间。长轮询是一种消息接收方式，当队列中没有消息时，它允许请求在服务器端等待一段时间，直到有新消息到达或达到最大等待时间。
    # 如果请求时队列中没有消息，SQS会保持连接最多该设置的秒数，等待消息到达。如果在等待时间内有消息到达，SQS会立即返回这些消息。
}