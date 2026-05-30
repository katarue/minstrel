# Pre-Flight Check（作業前の必須確認）

新規セッション開始時に必ずこの順序で実行する。

```
CHECK 1: pwd + git remote -v でリポジトリを確認
         期待値: C:\Users\katar\repos\active\minstrel
                 origin → https://github.com/katarue/minstrel.git

CHECK 2: 禁止パスの非存在確認
         .NEW / .OLD / _v2 / _temp / _backup を含むパスがないか確認

CHECK 3: git status でワーキングツリーがクリーンか確認

CHECK 4: @docs/folder_structure.md を読む（リポジトリ構造の把握）
```
