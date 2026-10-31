# eprj2 继承封装兼容修复


文件为有效SQLite工程，quick_check为ok，共三个PCB。第一块有119个COMPONENT和402条PAD_NET记录，其中8个元件没有实例级Footprint属性，但Device指向的attributes表中存在有效Footprint。原解析器已经读取devices属性，却只使用实例上的Footprint查封装库，因此在LED6报错后终止。

修复只增加缺省封装解析：先使用现有PCB实例ATTR Footprint，其次实例属性对象Footprint，最后使用Device属性中的Footprint。存在但指向无效库的显式实例引用继续报错，不偷偷换成库默认封装。仍没有可用封装时保留错误，未通过跳过元件或伪造封装绕开问题。DOCTYPE-only的空PCB给出明确提示，不捏造板框。

验证：
- 第一块QQT891_1_V02：119元件、402焊盘，约60×66mm。
- 第二块QQT891_2_V02：87元件、382焊盘，约55×125.5mm。
- 第三块QQT891_3_V01：仅PCB DOCTYPE记录，明确提示空白文档。
- test-pro-footprint-fallback.cjs 覆盖继承、显式优先、实例属性优先、焊盘保留、显式错误不被默认值掩盖、真实缺失仍报错。
- test-eprj2-current.cjs 对真实三板计数及空白消息做断言。
- test-epro2-fix.cjs 使用当前构建Worker，回归当前可用的先前36W epro2及V3空删除记录；当前样例目录只找到这一份旧工程，不将历史42W验证计入本轮。

