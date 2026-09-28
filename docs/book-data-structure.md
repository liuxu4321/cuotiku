# 错题数据结构（供后台参考）

后台管理错题数据时，可参考客户端当前本地存储的结构（`~/.cuotiku`：SQLite `entries` 表 + 每条错题一张 PNG 图片）。

## 字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string(UUID) | 错题主键 |
| grade | int | 年级，1-9 |
| subject | string | 科目：语文 / 数学 / 英语 |
| error_type | string | 错误类型：马虎 / 不会 / 概念不清 / 其他 |
| created_at | int(毫秒时间戳) | 加入错题集的时间 |
| width | int | 错题图片宽度（像素） |
| height | int | 错题图片高度（像素） |
| practice_count | int | 刷题次数，每次组卷打印成功 +1 |
| file | string | 错题图片文件名（同目录 PNG，如 `<id>.png`） |

## 示例

```json
{
  "id": "3f6c1a2e-9b8d-4e5f-8a7c-1d2e3f4a5b6c",
  "grade": 7,
  "subject": "数学",
  "error_type": "马虎",
  "created_at": 1790000000000,
  "width": 1280,
  "height": 640,
  "practice_count": 3,
  "file": "3f6c1a2e-9b8d-4e5f-8a7c-1d2e3f4a5b6c.png"
}
```
