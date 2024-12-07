ALTER TABLE image ADD COLUMN explicit REAL;
ALTER TABLE image ADD COLUMN sensitive REAL;
ALTER TABLE image ADD COLUMN questionable REAL;
ALTER TABLE image ADD COLUMN general REAL;

UPDATE image
SET
general = (
    SELECT prob
    FROM image_tag
    WHERE image_tag.image_id = image.image_id
      AND image_tag.tag_id = 0
    LIMIT 1
),
sensitive = (
    SELECT prob
    FROM image_tag
    WHERE image_tag.image_id = image.image_id
      AND image_tag.tag_id = 1
    LIMIT 1
),
questionable = (
    SELECT prob
    FROM image_tag
    WHERE image_tag.image_id = image.image_id
      AND image_tag.tag_id = 2
    LIMIT 1
),
explicit = (
    SELECT prob
    FROM image_tag
    WHERE image_tag.image_id = image.image_id
      AND image_tag.tag_id = 3
    LIMIT 1
);

DELETE FROM image_tag WHERE tag_id <=3;