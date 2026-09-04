# Training Data v3

Pre-processed and normalized training dataset for the
sentiment analysis model.

## Files
- `training_data_v3.pkl` -- 45,000 labeled samples
- `validation_split.pkl` -- 5,000 labeled samples

## Usage

```python
import pickle
with open('data/training_data_v3.pkl', 'rb') as f:
    data = pickle.load(f)
```

## Preprocessing
- Tokenized with spaCy v3.6
- Normalized, lowercased, stopwords removed
- Labels: 0=negative, 1=neutral, 2=positive
