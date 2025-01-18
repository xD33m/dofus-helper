import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/translate', (req, res) => {
  const term = req.query.term || '';
  const translation = `Translation of "${term}" in Another Language`;
  res.json({ term, translation });
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);

});
