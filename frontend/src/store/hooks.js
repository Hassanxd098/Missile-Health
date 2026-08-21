import { useDispatch, useSelector } from "react-redux";

/**
 * Custom typed hooks for Redux Toolkit store.
 * Provides clean dispatching and state selection throughout the application.
 */
export const useAppDispatch = () => useDispatch();
export const useAppSelector = useSelector;
