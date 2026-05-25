from typing import List
import cv2
import pandas as pd
from deepface import DeepFace

DeepFace.stream(db_path = "video_db")


#objs: List[dict] = DeepFace.analyze(
#  img_path = "img/img4.jpg", actions = ['age', 'gender', 'race', 'emotion']
#)

#print(objs)
# ver tipo de objeto
#print(type(objs))
#print(objs[0]["dominant_emotion"])