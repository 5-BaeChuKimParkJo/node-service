CREATE TABLE "Category" (
    "categoryId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT,
    CONSTRAINT "Category_pkey" PRIMARY KEY ("categoryId")
);

CREATE TABLE "Tag" (
    "tagId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    CONSTRAINT "Tag_pkey" PRIMARY KEY ("tagId")
);

CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");
CREATE UNIQUE INDEX "Tag_name_key" ON "Tag"("name");

INSERT INTO "Category" ("categoryId", "name", "description") VALUES
    (1, '디지털', '휴대폰, 컴퓨터, 카메라와 주변기기'),
    (2, '패션', '의류, 신발, 가방과 액세서리'),
    (3, '취미', '도서, 음반, 게임과 수집품'),
    (4, '생활', '가구, 주방, 생활용품'),
    (5, '스포츠', '스포츠와 레저 용품'),
    (6, '기타', '다른 분류에 속하지 않는 물품')
ON CONFLICT ("categoryId") DO NOTHING;

INSERT INTO "Tag" ("tagId", "name") VALUES
    (1, '미개봉'),
    (2, '한정판'),
    (3, '빈티지'),
    (4, '직거래'),
    (5, '무료배송')
ON CONFLICT ("tagId") DO NOTHING;
