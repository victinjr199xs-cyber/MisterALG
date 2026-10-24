-- School database (PostgreSQL). Run the whole script to create and fill the tables.

DROP TABLE IF EXISTS matriculas;
DROP TABLE IF EXISTS disciplinas;
DROP TABLE IF EXISTS alunos;

CREATE TABLE alunos (
    id     INTEGER PRIMARY KEY,
    nome   VARCHAR(60) NOT NULL,
    cidade VARCHAR(40)
);

CREATE TABLE disciplinas (
    id            INTEGER PRIMARY KEY,
    nome          VARCHAR(60) NOT NULL,
    carga_horaria INTEGER
);

CREATE TABLE matriculas (
    id            INTEGER PRIMARY KEY,
    aluno_id      INTEGER NOT NULL REFERENCES alunos (id),
    disciplina_id INTEGER NOT NULL REFERENCES disciplinas (id),
    nota          NUMERIC(4, 1)
);

INSERT INTO alunos (id, nome, cidade) VALUES
    (1, 'Ana', 'Recife'),
    (2, 'Bruno', 'Olinda'),
    (3, 'Carla', 'Recife'),
    (4, 'Diego', 'Jaboatao'),
    (5, 'Elisa', 'Olinda');

INSERT INTO disciplinas (id, nome, carga_horaria) VALUES
    (1, 'Algoritmos', 60),
    (2, 'Banco de Dados', 80),
    (3, 'Redes', 60),
    (4, 'Estatistica', 40),
    (5, 'Ingles Tecnico', 30);

INSERT INTO matriculas (id, aluno_id, disciplina_id, nota) VALUES
    (1, 1, 1, 8.5),
    (2, 1, 2, 7.0),
    (3, 2, 1, 9.0),
    (4, 3, 3, 6.5),
    (5, 4, 2, 8.0),
    (6, 5, 1, 5.5);

-- 1. JOIN: list each enrollment with the student and subject names
SELECT a.nome AS aluno, d.nome AS disciplina, m.nota
FROM matriculas m
JOIN alunos a ON a.id = m.aluno_id
JOIN disciplinas d ON d.id = m.disciplina_id
ORDER BY a.nome, d.nome;

-- 2. GROUP BY with COUNT: how many students are enrolled in each subject
-- (LEFT JOIN keeps subjects with no students, showing 0)
SELECT d.nome AS disciplina, COUNT(m.id) AS total_alunos
FROM disciplinas d
LEFT JOIN matriculas m ON m.disciplina_id = d.id
GROUP BY d.nome;

-- 3. ORDER BY: students sorted by city, then by name
SELECT nome, cidade
FROM alunos
ORDER BY cidade, nome;
