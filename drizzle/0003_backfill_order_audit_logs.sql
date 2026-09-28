INSERT INTO `order_audit_logs` (`job_id`, `action`, `actor_name`, `actor_email`, `detail`)
SELECT
	`order_jobs`.`id`,
	'ORDER_IMPORTED',
	'시스템 이관',
	'',
	'기존 주문 작업에 감사 로그 기준을 적용했습니다.'
FROM `order_jobs`
WHERE NOT EXISTS (
	SELECT 1
	FROM `order_audit_logs`
	WHERE `order_audit_logs`.`job_id` = `order_jobs`.`id`
);
